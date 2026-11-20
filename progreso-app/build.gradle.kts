// Mi Progreso · compilación con Gradle (29.0). La estructura del proyecto no cambia:
// el manifiesto, src/, res/ y assets/ se usan desde su ubicación de siempre.
plugins {
    id("com.android.application") version "8.11.1"
    id("org.jetbrains.kotlin.android") version "2.0.21"
}

val keystorePath = System.getenv("KEYSTORE") ?: "keystore/miprogreso.p12"

android {
    namespace = "com.zoidan.progreso"
    compileSdk = 36
    buildToolsVersion = "35.0.0"

    defaultConfig {
        applicationId = "com.zoidan.progreso"
        minSdk = 26
        targetSdk = 34
        versionCode = 39
        versionName = "34.0"
    }

    signingConfigs {
        create("release") {
            storeFile = file(keystorePath)
            storeType = "pkcs12"
            storePassword = System.getenv("KEY_PASS") ?: "miprogreso"
            keyAlias = System.getenv("KEY_ALIAS") ?: "miprogreso"
            keyPassword = System.getenv("KEY_PASS") ?: "miprogreso"
            enableV1Signing = false
            enableV2Signing = true
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    sourceSets.getByName("main") {
        manifest.srcFile("AndroidManifest.xml")
        java.srcDirs("src")
        res.srcDirs("res")
        assets.srcDirs("assets")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    lint { abortOnError = false; checkReleaseBuilds = false }
    // Los assets se empaquetan tal cual (incluidos los que empiezan con "_" o ".": no hay)
    androidResources { ignoreAssetsPattern = "!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~" }
    packaging { resources.excludes += setOf("META-INF/*.kotlin_module", "META-INF/AL2.0", "META-INF/LGPL2.1") }
}

dependencies {
    // Health Connect: Android 8–13 (app de Google Play) y 14+ (integrado al sistema)
    implementation("androidx.health.connect:connect-client:1.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
