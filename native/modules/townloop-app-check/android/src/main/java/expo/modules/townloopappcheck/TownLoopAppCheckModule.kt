package expo.modules.townloopappcheck

import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TownLoopAppCheckModule : Module() {
  private var appCheck: FirebaseAppCheck? = null

  private fun initializeProvider() {
    if (appCheck != null) return
    val context = appContext.reactContext ?: error("App Check context unavailable")
    // Reuse the default app configured by existing google-services resources.
    val app = FirebaseApp.getInstance()
    check(context.packageName == "com.townloop.app"
      && app.options.projectId == "cc-livingcommunity-app"
      && app.options.applicationId == "1:883715389126:android:869aa93ffdc82d5127c9c7") {
      "App Check configuration does not match TownLoop"
    }
    appCheck = FirebaseAppCheck.getInstance(app).also {
      it.installAppCheckProviderFactory(PlayIntegrityAppCheckProviderFactory.getInstance())
      // Firebase JS owns refresh while the app is active; avoid a second refresh loop.
      it.setTokenAutoRefreshEnabled(false)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("TownLoopAppCheck")

    Function("initialize") {
      initializeProvider()
    }

    AsyncFunction("getToken") { forceRefresh: Boolean, promise: Promise ->
      try {
        initializeProvider()
        appCheck!!.getAppCheckToken(forceRefresh)
          .addOnSuccessListener { result ->
            // Preserve native expiration exactly; no fabricated token or TTL.
            promise.resolve(mapOf(
              "token" to result.token,
              "expireTimeMillis" to result.expireTimeMillis.toDouble()
            ))
          }
          .addOnFailureListener {
            promise.reject("ERR_APP_CHECK_UNAVAILABLE", "App Check monitoring token unavailable", null)
          }
      } catch (_: Exception) {
        promise.reject("ERR_APP_CHECK_UNAVAILABLE", "App Check monitoring token unavailable", null)
      }
    }
  }
}
