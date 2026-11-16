import ExpoModulesCore
import StoreKit

public class AppClipModule: Module {
  private static let isAppClip = Bundle.main.infoDictionary?["NSAppClip"] != nil

  public func definition() -> ModuleDefinition {
    Name("AppClip")

    Constant("isAppClip") {
      AppClipModule.isAppClip
    }

    AsyncFunction("promptFullApp") {
      guard AppClipModule.isAppClip,
            let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
      else { return }
      SKOverlay(configuration: SKOverlay.AppClipConfiguration(position: .bottom)).present(in: scene)
    }.runOnQueue(.main)
  }
}
