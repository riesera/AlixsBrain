package com.alixsbrain.healthsync

import android.app.Activity
import android.os.Bundle
import android.text.method.ScrollingMovementMethod
import android.widget.TextView

class PrivacyPolicyActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(TextView(this).apply {
            text = """
                AlixsBrain Health Sync — Proof-of-Concept Privacy Notice

                This private proof of concept requests read-only access to steps, sleep, exercise, nutrition, hydration, weight, and resting heart rate in Health Connect.

                It reads only the seven-day range selected on screen. Results are displayed locally. This proof of concept has no network permission, does not upload health data, does not write to Health Connect, and does not retain a health database.

                Missing values are displayed as missing, not as zero. The app does not provide diagnosis or medical advice.

                Permissions can be revoked at any time in Health Connect or Android app settings.
            """.trimIndent()
            textSize = 16f
            setPadding(40, 48, 40, 48)
            movementMethod = ScrollingMovementMethod()
        })
    }
}
