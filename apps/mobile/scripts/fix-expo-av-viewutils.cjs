/**
 * expo-av@14.0.7: legacy Expo UIManager.resolveView was removed; use RN UIManagerHelper + bridge UIManager.
 * Runs after patch-package (CMake fix) on every install.
 */
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-av",
  "android",
  "src",
  "main",
  "java",
  "expo",
  "modules",
  "av",
  "ViewUtils.kt"
);

const fixed = `package expo.modules.av

import androidx.annotation.AnyThread
import androidx.annotation.UiThread
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.IllegalViewOperationException
import com.facebook.react.uimanager.UIManagerHelper
import expo.modules.av.video.VideoView
import expo.modules.av.video.VideoViewWrapper
import expo.modules.core.ModuleRegistry
import expo.modules.core.Promise

object ViewUtils {
  interface VideoViewCallback {
    fun runWithVideoView(videoView: VideoView): Unit
  }

  @UiThread
  private fun resolveVideoViewWrapper(moduleRegistry: ModuleRegistry, viewTag: Int): VideoViewWrapper? {
    val appContext = moduleRegistry.appContext ?: return null
    val reactContext = appContext.reactContext as? ReactContext ?: return null
    return UIManagerHelper.getUIManagerForReactTag(reactContext, viewTag)
      ?.resolveView(viewTag) as? VideoViewWrapper
  }

  @UiThread
  private fun tryRunWithVideoViewOnUiThread(moduleRegistry: ModuleRegistry, viewTag: Int, callback: VideoViewCallback, promise: Promise) {
    try {
      val videoWrapperView = resolveVideoViewWrapper(moduleRegistry, viewTag)
      val videoView = videoWrapperView?.videoViewInstance
      if (videoView != null) {
        callback.runWithVideoView(videoView)
      } else {
        promise.reject("E_VIDEO_TAGINCORRECT", "Invalid view returned from registry.")
      }
    } catch (e: IllegalViewOperationException) {
      promise.reject("E_VIDEO_TAGINCORRECT", "Invalid view returned from registry.")
    }
  }

  /**
   * Rejects the promise if the VideoView is not found, otherwise executes the callback.
   */
  @JvmStatic
  @AnyThread
  @Deprecated("Use \`dispatchCommands\` in favor of finding view with imperative calls")
  fun tryRunWithVideoView(moduleRegistry: ModuleRegistry, viewTag: Int, callback: VideoViewCallback, promise: Promise) {
    if (UiThreadUtil.isOnUiThread()) {
      tryRunWithVideoViewOnUiThread(moduleRegistry, viewTag, callback, promise)
    } else {
      UiThreadUtil.runOnUiThread {
        tryRunWithVideoViewOnUiThread(moduleRegistry, viewTag, callback, promise)
      }
    }
  }

  @UiThread
  private fun tryRunWithVideoViewOnUiThread(moduleRegistry: ModuleRegistry, viewTag: Int, callback: VideoViewCallback, promise: expo.modules.kotlin.Promise) {
    try {
      val videoWrapperView = resolveVideoViewWrapper(moduleRegistry, viewTag)
      val videoView = videoWrapperView?.videoViewInstance
      if (videoView != null) {
        callback.runWithVideoView(videoView)
      } else {
        promise.reject("E_VIDEO_TAGINCORRECT", "Invalid view returned from registry.", null)
      }
    } catch (e: IllegalViewOperationException) {
      promise.reject("E_VIDEO_TAGINCORRECT", "Invalid view returned from registry.", null)
    }
  }

  /**
   * Rejects the promise if the VideoView is not found, otherwise executes the callback.
   */
  @AnyThread
  @Deprecated("Use \`dispatchCommands\` in favor of finding view with imperative calls")
  fun tryRunWithVideoView(moduleRegistry: ModuleRegistry, viewTag: Int, callback: VideoViewCallback, promise: expo.modules.kotlin.Promise) {
    if (UiThreadUtil.isOnUiThread()) {
      tryRunWithVideoViewOnUiThread(moduleRegistry, viewTag, callback, promise)
    } else {
      UiThreadUtil.runOnUiThread {
        tryRunWithVideoViewOnUiThread(moduleRegistry, viewTag, callback, promise)
      }
    }
  }
}
`;

try {
  if (!fs.existsSync(target)) {
    process.exit(0);
  }
  const current = fs.readFileSync(target, "utf8");
  if (!current.includes("getModule(UIManager::class.java)")) {
    process.exit(0);
  }
  fs.writeFileSync(target, fixed, "utf8");
  console.log("fix-expo-av-viewutils: updated ViewUtils.kt for React Native 0.83");
} catch (e) {
  console.warn("fix-expo-av-viewutils:", e.message);
  process.exit(0);
}
