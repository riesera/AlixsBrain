package com.alixsbrain.healthsync

import android.app.DatePickerDialog
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

class MainActivity : ComponentActivity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private lateinit var reader: HealthConnectReader
    private lateinit var startDateInput: EditText
    private lateinit var status: TextView
    private lateinit var output: TextView
    private lateinit var grantButton: Button
    private lateinit var historyButton: Button
    private lateinit var readButton: Button
    private lateinit var syncButton: Button
    private val syncClient by lazy { HealthSyncClient(BuildConfig.HEALTH_SYNC_URL, BuildConfig.HEALTH_SYNC_TOKEN) }

    private val permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { refreshPermissionState() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildScreen())
        when (HealthConnectClient.getSdkStatus(this)) {
            HealthConnectClient.SDK_AVAILABLE -> {
                reader = HealthConnectReader(HealthConnectClient.getOrCreate(this))
                grantButton.isEnabled = true
                historyButton.isEnabled = reader.isHistoryReadAvailable()
                refreshPermissionState()
            }
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                status.text = "Health Connect needs to be installed or updated before this proof of concept can read data."
                grantButton.text = "Open Health Connect"
                grantButton.isEnabled = true
                grantButton.setOnClickListener {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.apps.healthdata")))
                }
            }
            else -> status.text = "Health Connect is unavailable on this device. Android 9 or newer is required."
        }
    }

    private fun buildScreen(): ScrollView {
        val scroll = ScrollView(this)
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(40))
        }
        scroll.addView(content)

        content.addView(TextView(this).apply {
            text = "AlixsBrain Health Sync"
            textSize = 26f
            setTextColor(Color.rgb(23, 37, 84))
        })
        content.addView(TextView(this).apply {
            text = "Reads Health Connect locally. Cloud sync is available only in builds configured with the separate device credential."
            textSize = 15f
            setPadding(0, dp(8), 0, dp(18))
        })

        status = TextView(this).apply {
            text = "Checking Health Connect…"
            setPadding(dp(12), dp(12), dp(12), dp(12))
            setBackgroundColor(Color.rgb(232, 238, 252))
        }
        content.addView(status, matchWidth())

        grantButton = Button(this).apply {
            text = "Grant read permissions"
            isEnabled = false
            setOnClickListener { permissionLauncher.launch(reader.requiredPermissions) }
        }
        content.addView(grantButton, spacedWidth())

        historyButton = Button(this).apply {
            text = "Grant historical read (optional)"
            isEnabled = false
            setOnClickListener { permissionLauncher.launch(reader.historyPermission) }
        }
        content.addView(historyButton, spacedWidth())

        startDateInput = EditText(this).apply {
            isFocusable = false
            hint = "Seven-day range starts"
            setText(LocalDate.now().minusDays(6).toString())
            setOnClickListener { chooseDate() }
        }
        content.addView(startDateInput, spacedWidth())

        readButton = Button(this).apply {
            text = "Read seven days"
            isEnabled = false
            setOnClickListener { readHealthData() }
        }
        content.addView(readButton, spacedWidth())

        syncButton = Button(this).apply {
            text = "Sync accessible 30-day backfill"
            isEnabled = false
            setOnClickListener { syncAccessibleHistory() }
        }
        content.addView(syncButton, spacedWidth())

        val settingsButton = Button(this).apply {
            text = "Open app settings"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
            }
        }
        content.addView(settingsButton, spacedWidth())

        output = TextView(this).apply {
            text = "Grant permissions, choose a start date, then read the seven-day range."
            textSize = 14f
            setTextIsSelectable(true)
            setPadding(dp(12), dp(16), dp(12), dp(16))
        }
        content.addView(output, spacedWidth())
        return scroll
    }

    private fun refreshPermissionState() {
        scope.launch {
            val granted = reader.hasRequiredPermissions()
            val historyGranted = reader.hasHistoryPermission()
            readButton.isEnabled = granted
            syncButton.isEnabled = granted && syncClient.isConfigured
            status.text = if (granted) {
                "Read permissions granted. Historical read: ${if (historyGranted) "granted" else "not granted"}. Sync: ${if (syncClient.isConfigured) "configured" else "disabled"}."
            } else {
                "Health Connect permission is incomplete. Grant the requested read access to continue."
            }
        }
    }

    private fun syncAccessibleHistory() {
        syncButton.isEnabled = false
        readButton.isEnabled = false
        status.text = "Preparing 30-day Health Connect backfill…"
        scope.launch {
            try {
                val zone = ZoneId.systemDefault()
                val firstDate = LocalDate.now().minusDays(29)
                val preferences = getPreferences(MODE_PRIVATE)
                val deviceId = preferences.getString("sync_device_id", null)
                    ?: UUID.randomUUID().toString().also {
                        preferences.edit().putString("sync_device_id", it).apply()
                    }
                repeat(30) { offset ->
                    val date = firstDate.plusDays(offset.toLong())
                    status.text = "Syncing ${offset + 1}/30: $date"
                    val summary = reader.readDay(date, zone)
                    withContext(Dispatchers.IO) { syncClient.upload(deviceId, zone, summary) }
                }
                status.text = "30-day sync complete. Re-running it safely replaces the same dated summaries."
            } catch (error: Exception) {
                status.text = "Sync stopped: ${error.message ?: error::class.simpleName}. Completed dates remain stored; retry is safe."
            } finally {
                readButton.isEnabled = true
                syncButton.isEnabled = syncClient.isConfigured
            }
        }
    }

    private fun chooseDate() {
        val current = runCatching { LocalDate.parse(startDateInput.text.toString()) }.getOrElse { LocalDate.now().minusDays(6) }
        DatePickerDialog(this, { _, year, month, day ->
            startDateInput.setText(LocalDate.of(year, month + 1, day).toString())
        }, current.year, current.monthValue - 1, current.dayOfMonth).show()
    }

    private fun readHealthData() {
        val start = runCatching { LocalDate.parse(startDateInput.text.toString()) }.getOrElse {
            status.text = "Choose a valid start date."
            return
        }
        readButton.isEnabled = false
        output.text = "Reading Health Connect…"
        scope.launch {
            try {
                val summary = reader.readSevenDays(start, ZoneId.systemDefault())
                output.text = HealthSummaryText.render(summary)
                status.text = "Read complete. Values are displayed locally and were not uploaded."
            } catch (error: Exception) {
                output.text = "Health Connect read failed: ${error::class.simpleName}: ${error.message ?: "No details"}"
                status.text = "No data was uploaded. Check permissions and try again."
            } finally {
                readButton.isEnabled = true
            }
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
    private fun matchWidth() = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    private fun spacedWidth() = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(12)
    }
}
