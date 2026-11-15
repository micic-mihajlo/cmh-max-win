Pod::Spec.new do |s|
  s.name           = 'AppClip'
  s.version        = '1.0.0'
  s.summary        = 'Tells JS it runs inside the SIGNAL App Clip and shows the full-app overlay'
  s.author         = 'SIGNAL'
  s.homepage       = 'https://signal-app-wine.vercel.app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
