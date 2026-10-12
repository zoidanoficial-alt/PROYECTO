import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/**
 * Firma una APK con el esquema v2 (suficiente desde Android 7.0, nuestro mínimo) usando apksig (la librería de apksigner)
 * y verifica el resultado.
 *
 * Uso: java -cp apksig.jar:. Firmar entrada.apk salida.apk almacen.p12 alias clave
 */
public class Firmar {
    public static void main(String[] args) throws Exception {
        if (args.length != 5) {
            System.err.println("Uso: Firmar entrada.apk salida.apk almacen.p12 alias clave");
            System.exit(2);
        }
        File entrada = new File(args[0]);
        File salida = new File(args[1]);
        char[] clave = args[4].toCharArray();

        KeyStore almacen = KeyStore.getInstance("PKCS12");
        try (FileInputStream in = new FileInputStream(args[2])) {
            almacen.load(in, clave);
        }
        PrivateKey llave = (PrivateKey) almacen.getKey(args[3], clave);
        X509Certificate cert = (X509Certificate) almacen.getCertificate(args[3]);

        ApkSigner.SignerConfig config = new ApkSigner.SignerConfig.Builder(
                "actuaryos", llave, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(config))
                .setInputApk(entrada)
                .setOutputApk(salida)
                .setMinSdkVersion(24)
                .setV1SigningEnabled(false)  // minSdk 24 (Android 7.0) ya verifica v2
                .setV2SigningEnabled(true)
                .build()
                .sign();

        ApkVerifier.Result r = new ApkVerifier.Builder(salida).build().verify();
        if (!r.isVerified()) {
            for (Object e : r.getErrors()) System.err.println("ERROR: " + e);
            System.exit(1);
        }
        System.out.println("Firma verificada: v2=" + r.isVerifiedUsingV2Scheme());
    }
}
