# 本工程没有反射、没有序列化框架，也不需要额外规则。
# 保留 WebView 的 JS 接口相关注解（如果以后加 @JavascriptInterface）。
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
