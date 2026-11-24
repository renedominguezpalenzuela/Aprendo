import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBootSplash

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "Mason",
      in: window,
      launchOptions: launchOptions
    )

    // Monta el splash nativo sobre la rootView, que startReactNative ya dejo
    // creada y asignada a la window. A partir de aca la pantalla la controla la
    // app: solo se oculta cuando el JS llama a BootSplash.hide().
    //
    // POR QUE ACA Y NO EN UN HOOK DEL DELEGATE: el README de
    // react-native-bootsplash indica sobreescribir `customize(_:)`, que no
    // existe en React Native 0.80. El metodo equivalente es `customizeRootView:`,
    // pero esta declarado en el protocolo RCTUIConfiguratorProtocol y no en el
    // header de RCTDefaultReactNativeFactoryDelegate, asi que Swift no lo ve
    // como miembro heredado: `override` falla con "does not override any method
    // from its superclass" y `super.customizeRootView` con "has no member".
    // Esta via usa solo API publica declarada en headers.
    //
    // Ver specs/features/splash-screen/design.md seccion 2.1.
    RNBootSplash.initWithStoryboard("BootSplash", rootView: window?.rootViewController?.view)

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }

}
