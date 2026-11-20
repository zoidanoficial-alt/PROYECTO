package com.zoidan.progreso;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;

import org.json.JSONObject;

import java.util.Collections;
import java.util.UUID;

/**
 * Pulso en vivo con el perfil estándar Bluetooth "Heart Rate" (servicio 0x180D, medición 0x2A37).
 * Funciona con bandas de pecho y con relojes que transmiten el pulso. Entrega bpm e intervalos R-R.
 * Los permisos los pide MainActivity antes de llamar aquí.
 */
class HrLink {

    interface Out { void js(String code); }

    static final UUID HR_SERVICE = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb");
    static final UUID HR_MEASUREMENT = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb");
    static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Context ctx;
    private final Out out;
    private final Handler main = new Handler(Looper.getMainLooper());
    private BluetoothLeScanner scanner;
    private ScanCallback scanCallback;
    private BluetoothGatt gatt;
    private String wanted;   // dirección a la que queremos seguir conectados (reconexión automática)

    HrLink(Context ctx, Out out) { this.ctx = ctx; this.out = out; }

    private BluetoothAdapter adapter() {
        BluetoothManager bm = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        return bm != null ? bm.getAdapter() : null;
    }

    private void status(String s) { out.js("window.onHrStatus && window.onHrStatus(" + JSONObject.quote(s) + ")"); }

    @SuppressWarnings("MissingPermission")
    void scan() {
        BluetoothAdapter a = adapter();
        if (a == null) { status("unsupported"); return; }
        if (!a.isEnabled()) { status("off"); return; }
        stopScan();
        scanner = a.getBluetoothLeScanner();
        if (scanner == null) { status("off"); return; }
        scanCallback = new ScanCallback() {
            @Override
            public void onScanResult(int type, ScanResult r) {
                BluetoothDevice d = r.getDevice();
                String name = d.getName() != null ? d.getName() : (r.getScanRecord() != null ? r.getScanRecord().getDeviceName() : null);
                try {
                    JSONObject o = new JSONObject();
                    o.put("id", d.getAddress());
                    o.put("name", name != null ? name : "Sensor de pulso");
                    o.put("rssi", r.getRssi());
                    out.js("window.onHrDevice && window.onHrDevice(" + o + ")");
                } catch (Exception ignored) { }
            }
            @Override
            public void onScanFailed(int code) { status("scan_failed"); }
        };
        ScanFilter f = new ScanFilter.Builder().setServiceUuid(new ParcelUuid(HR_SERVICE)).build();
        ScanSettings st = new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build();
        scanner.startScan(Collections.singletonList(f), st, scanCallback);
        status("scanning");
        main.postDelayed(new Runnable() { @Override public void run() { if (scanCallback != null) { stopScan(); status("scan_done"); } } }, 15000);
    }

    @SuppressWarnings("MissingPermission")
    void stopScan() {
        if (scanner != null && scanCallback != null) { try { scanner.stopScan(scanCallback); } catch (Exception ignored) { } }
        scanCallback = null;
    }

    @SuppressWarnings("MissingPermission")
    void connect(String address) {
        BluetoothAdapter a = adapter();
        if (a == null || address == null) { status("unsupported"); return; }
        stopScan();
        wanted = address;
        if (gatt != null) { gatt.close(); gatt = null; }
        status("connecting");
        gatt = a.getRemoteDevice(address).connectGatt(ctx, false, callback, BluetoothDevice.TRANSPORT_LE);
    }

    @SuppressWarnings("MissingPermission")
    void disconnect() {
        wanted = null;
        if (gatt != null) { gatt.disconnect(); gatt.close(); gatt = null; }
        status("disconnected");
    }

    private final BluetoothGattCallback callback = new BluetoothGattCallback() {
        @Override
        @SuppressWarnings("MissingPermission")
        public void onConnectionStateChange(BluetoothGatt g, int st, int state) {
            if (state == BluetoothProfile.STATE_CONNECTED) { status("connected"); g.discoverServices(); return; }
            if (state == BluetoothProfile.STATE_DISCONNECTED) {
                status("disconnected");
                g.close();
                if (g == gatt) gatt = null;
                final String addr = wanted;
                if (addr != null) main.postDelayed(new Runnable() { @Override public void run() { if (addr.equals(wanted) && gatt == null) connect(addr); } }, 3000);
            }
        }

        @Override
        @SuppressWarnings({ "MissingPermission", "deprecation" })
        public void onServicesDiscovered(BluetoothGatt g, int st) {
            BluetoothGattService s = g.getService(HR_SERVICE);
            BluetoothGattCharacteristic c = s != null ? s.getCharacteristic(HR_MEASUREMENT) : null;
            if (c == null) { status("no_hr_service"); return; }
            g.setCharacteristicNotification(c, true);
            BluetoothGattDescriptor d = c.getDescriptor(CCCD);
            if (d != null) { d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE); g.writeDescriptor(d); }
            status("streaming");
        }

        // Android 13+
        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c, byte[] value) { emit(value); }

        // Android 8–12
        @Override
        @SuppressWarnings("deprecation")
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c) { emit(c.getValue()); }
    };

    /** Formato de la medición de pulso (Bluetooth SIG): flags, bpm (8 o 16 bits), energía opcional, R-R en 1/1024 s. */
    static String parse(byte[] v) {
        if (v == null || v.length < 2) return null;
        int flags = v[0] & 0xff, i;
        int bpm;
        if ((flags & 0x01) != 0) { if (v.length < 3) return null; bpm = (v[1] & 0xff) | ((v[2] & 0xff) << 8); i = 3; }
        else { bpm = v[1] & 0xff; i = 2; }
        boolean contact = (flags & 0x04) == 0 || (flags & 0x02) != 0;
        if ((flags & 0x08) != 0) i += 2;
        StringBuilder rr = new StringBuilder("[");
        if ((flags & 0x10) != 0) {
            for (; i + 1 < v.length; i += 2) {
                int raw = (v[i] & 0xff) | ((v[i + 1] & 0xff) << 8);
                if (rr.length() > 1) rr.append(',');
                rr.append(Math.round(raw * 1000.0 / 1024.0));
            }
        }
        rr.append(']');
        return bpm + "," + rr + "," + contact;
    }

    private void emit(byte[] v) {
        String p = parse(v);
        if (p != null) out.js("window.onHr && window.onHr(" + p + "," + System.currentTimeMillis() + ")");
    }
}
