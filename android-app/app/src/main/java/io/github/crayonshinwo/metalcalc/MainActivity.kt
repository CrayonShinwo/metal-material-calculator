package io.github.crayonshinwo.metalcalc

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader

/**
 * 金属材料计算器 · 离线版
 *
 * 与旧的 PWABuilder「远程 TWA」版本的根本区别：
 *
 *   旧版：APK 里没有任何网页，启动时委托 Chrome 去下载
 *         https://crayonshinwo.github.io/metal-material-calculator/
 *         → 网络不通、或设备上没有 Chrome / 不支持 Custom Tabs，就永远停在启动图。
 *
 *   本版：HTML/CSS/JS/图标全部打包在 APK 的 assets/www/ 里，由 WebViewAssetLoader
 *         以 https://appassets.androidplatform.net/assets/www/ 这个**安全上下文**交给 WebView。
 *         因为走的是 https，ES Module、剪贴板 API 等特性都能正常用；同时又完全不经过网络。
 *         → 不需要 Chrome、不需要 Custom Tabs、不需要联网，飞行模式下也能秒开。
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    /**
     * 把 assets/ 挂到 https://appassets.androidplatform.net/assets/ 下。
     * 好处：请求是"https 同源"，浏览器安全策略不会拦（file:// 会被拦）。
     */
    private val assetLoader: WebViewAssetLoader by lazy {
        WebViewAssetLoader.Builder()
            .setDomain(APP_DOMAIN)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        webView.settings.apply {
            javaScriptEnabled = true          // js/app.js、js/install.js 都是 ES Module
            domStorageEnabled = true
            allowFileAccess = false           // 不碰 file://，全部走 asset loader
            allowContentAccess = false
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            mediaPlaybackRequiresUserGesture = true
        }
        webView.isVerticalScrollBarEnabled = false
        webView.setBackgroundColor(getColor(R.color.brand_bg))

        // Android 15（targetSdk 35）起强制边到边显示，这里把系统栏/挖孔区域留出来，
        // 免得页面标题被状态栏压住。
        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }

        webView.webViewClient = object : WebViewClient() {
            /** 所有本地资源都由 asset loader 在进程内直接返回，永远不碰网络 */
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

            /** 应用内页面自己处理；任何外链（例如文档里的 GitHub 地址）交给系统浏览器 */
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url
                return if (url.host == APP_DOMAIN) false else openInBrowser(url)
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (request.isForMainFrame) {
                    Log.e(TAG, "主文档加载失败：${error.errorCode} ${error.description} ${request.url}")
                    Toast.makeText(this@MainActivity, R.string.load_failed, Toast.LENGTH_LONG).show()
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        // 进程被回收后重建时优先恢复现场，否则从头加载
        val restored = savedInstanceState?.let { webView.restoreState(it) }
        if (restored == null) {
            webView.loadUrl(START_URL)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    private fun openInBrowser(uri: Uri): Boolean = try {
        startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    } catch (e: ActivityNotFoundException) {
        Log.w(TAG, "没有可以打开 $uri 的应用", e)
        false
    }

    companion object {
        private const val TAG = "MetalCalc"
        private const val APP_DOMAIN = "appassets.androidplatform.net"
        private const val START_URL = "https://$APP_DOMAIN/assets/www/index.html"
    }
}
