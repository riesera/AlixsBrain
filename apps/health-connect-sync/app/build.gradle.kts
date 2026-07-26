import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

layout.buildDirectory = rootProject.layout.projectDirectory.dir(".gradle/app-build")

val healthSyncUrl = providers.gradleProperty("healthSyncUrl").orElse("").get()
val healthSyncToken = providers.gradleProperty("healthSyncToken").orElse("").get()

android {
    namespace = "com.alixsbrain.healthsync"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.alixsbrain.healthsync"
        minSdk = 28
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-poc"
        buildConfigField("String", "HEALTH_SYNC_URL", "\"${healthSyncUrl.replace("\\", "\\\\").replace("\"", "\\\"")}\"")
        buildConfigField("String", "HEALTH_SYNC_TOKEN", "\"${healthSyncToken.replace("\\", "\\\\").replace("\"", "\\\"")}\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures { buildConfig = true }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.13.0")
    implementation("androidx.health.connect:connect-client:1.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")

    testImplementation("junit:junit:4.13.2")
}
