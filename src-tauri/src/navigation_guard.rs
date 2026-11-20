use tauri::webview::{NewWindowResponse, WebviewWindowBuilder};
use tauri::{Runtime, Url};

const MAIN_WINDOW: &str = "main";

/// Builds the main window from its configuration with two guards, so the app's own page is
/// the only thing it can ever show: navigation away from the app is cancelled, and every
/// new-window request (`window.open`, `target="_blank"`) is refused. Web links open in the
/// default browser instead, through the opener plugin.
pub fn create_main_window<R: Runtime>(
    app: &tauri::App<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == MAIN_WINDOW)
        .ok_or("The main window is missing from the configuration.")?
        .clone();
    // Only debug builds load the page from the development server.
    let dev_url = if cfg!(debug_assertions) {
        app.config().build.dev_url.clone()
    } else {
        None
    };
    WebviewWindowBuilder::from_config(app.handle(), &config)?
        .on_navigation(move |url| {
            let allowed = is_app_url(url, dev_url.as_ref());
            if !allowed {
                log::warn!("event=navigation-blocked");
            }
            allowed
        })
        .on_new_window(|_url, _features| {
            log::warn!("event=new-window-blocked");
            NewWindowResponse::Deny
        })
        .build()?;
    Ok(())
}

/// Whether a URL is Anehalo's own page (the bundled app, or the dev server in debug builds).
pub fn is_app_url(url: &Url, dev_url: Option<&Url>) -> bool {
    match url.scheme() {
        "tauri" => url.host_str() == Some("localhost"),
        "http" | "https" => {
            url.host_str() == Some("tauri.localhost")
                || dev_url.is_some_and(|dev| dev.origin() == url.origin())
        }
        "about" => url.as_str() == "about:blank",
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::is_app_url;
    use tauri::Url;

    fn url(text: &str) -> Url {
        match Url::parse(text) {
            Ok(url) => url,
            Err(error) => panic!("{text} is not a URL: {error}"),
        }
    }

    #[test]
    fn allows_only_the_app_itself() {
        for allowed in [
            "tauri://localhost/index.html",
            "http://tauri.localhost/",
            "https://tauri.localhost/assets/index.js",
            "about:blank",
        ] {
            assert!(
                is_app_url(&url(allowed), None),
                "{allowed} should be allowed"
            );
        }
        for refused in [
            "https://example.com/",
            "http://localhost:1420/",
            "https://tauri.localhost.example.com/",
            "file:///C:/Windows/System32/",
            "javascript:alert(1)",
            "data:text/html,<p>hi</p>",
            "about:srcdoc",
        ] {
            assert!(
                !is_app_url(&url(refused), None),
                "{refused} should be refused"
            );
        }
    }

    #[test]
    fn allows_the_development_server_only_when_given() {
        let dev = url("http://localhost:1420");
        assert!(is_app_url(
            &url("http://localhost:1420/src/main.tsx"),
            Some(&dev)
        ));
        assert!(!is_app_url(&url("http://localhost:1421/"), Some(&dev)));
    }
}
