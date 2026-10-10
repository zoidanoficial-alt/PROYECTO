import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** Firma (esquema v2; minSdk 26 no necesita v1) y verifica un APK con apksig, sin depender del SDK de Android. */
public class SignApk {
    public static void main(String[] args) throws Exception {
        if (args.length != 5) {
            System.err.println("uso: SignApk <keystore.p12> <alias> <password> <in.apk> <out.apk>");
            System.exit(2);
        }
        char[] pass = args[2].toCharArray();
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream in = new FileInputStream(args[0])) {
            ks.load(in, pass);
        }
        PrivateKey key = (PrivateKey) ks.getKey(args[1], pass);
        X509Certificate cert = (X509Certificate) ks.getCertificate(args[1]);

        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder(
                "CERT", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(new File(args[3]))
                .setOutputApk(new File(args[4]))
                .setV1SigningEnabled(false)
                .setV2SigningEnabled(true)
                .build()
                .sign();

        ApkVerifier.Result r = new ApkVerifier.Builder(new File(args[4])).build().verify();
        System.out.println("verificado=" + r.isVerified()
                + " v1=" + r.isVerifiedUsingV1Scheme()
                + " v2=" + r.isVerifiedUsingV2Scheme());
        if (!r.isVerified()) {
            for (ApkVerifier.IssueWithParams e : r.getErrors()) System.err.println("ERROR: " + e);
            System.exit(1);
        }
    }
}
