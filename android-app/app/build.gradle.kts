import java.io.File

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// ---------------------------------------------------------------------------
// 复用 PWABuilder 时代那套签名密钥（release/signing.keystore + signing.json），
// 这样新包可以直接覆盖安装老用户手机上的 TWA 版本（同一个 applicationId + 同一把钥匙）。
// release/ 是保密目录，绝不会进仓库，所以这里读不到时自动退回 debug 签名。
// ---------------------------------------------------------------------------
val releaseDir = rootProject.layout.projectDirectory.dir("../release").asFile
val keystoreFile = File(releaseDir, "signing.keystore")
val signingJsonFile = File(releaseDir, "signing.json")
val hasReleaseSigning = keystoreFile.isFile && signingJsonFile.isFile

/** signing.json 是 JSON（PWABuilder 的格式），这里用最小正则抽取三个字段，避免引入 JSON 依赖 */
fun signingField(name: String): String {
    val text = signingJsonFile.readText()
    val m = Regex("\"" + name + "\"\\s*:\\s*\"([^\"]*)\"").find(text)
        ?: throw GradleException("$signingJsonFile 里读不到字段 \"$name\"，无法签名")
    return m.groupValues[1]
}

if (hasReleaseSigning) {
    // 提前校验，避免打包到一半才报错
    listOf("storePassword", "keyPassword", "alias").forEach { signingField(it) }
    println("[metalcalc] 复用 release/signing.keystore 签名（写回旧版可直接覆盖安装）")
} else {
    println("[metalcalc] !! 没找到 release/signing.keystore + signing.json，release 包将不带签名配置")
}

android {
    namespace = "io.github.crayonshinwo.metalcalc"
    compileSdk = 35

    defaultConfig {
        // 必须和旧版一致，否则无法覆盖安装
        applicationId = "io.github.crayonshinwo.metalcalc"
        minSdk = 24
        targetSdk = 35
        // 必须比 PWABuilder 那版（versionCode 1）大
        versionCode = 2
        versionName = "1.1.0"
        resourceConfigurations += listOf("zh", "en")
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = keystoreFile
                storePassword = signingField("storePassword")
                keyAlias = signingField("alias")
                keyPassword = signingField("keyPassword")
                // 用 v1+v2+v3 全套，兼容 Android 7 到 15
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources.excludes += setOf("META-INF/*.kotlin_module", "DebugProbesKt.bin", "kotlin-tooling-metadata.json")
    }

    // 本地资源已经是压缩好的静态文件，不再二次压缩（WebView 读取更快、也更省事）
    androidResources {
        noCompress += listOf("html", "js", "css", "json", "png", "webp", "svg", "woff2")
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    // WebViewAssetLoader：把 assets/ 以 https://appassets.androidplatform.net/ 提供给 WebView
    implementation("androidx.webkit:webkit:1.12.1")
}

// 方便：`./gradlew offlineAssets` 重新从 site/ 生成 assets/www
tasks.register<Exec>("offlineAssets") {
    description = "从 site/ 重新生成离线 App 的本地资源（等价于 node tools/bundle-offline.mjs）"
    group = "build"
    workingDir = rootProject.layout.projectDirectory.dir("..").asFile
    commandLine("node", "tools/bundle-offline.mjs")
}
