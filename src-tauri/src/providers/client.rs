use serde::Deserialize;

use super::types::RemoteModel;

#[derive(Deserialize)]
struct ModelsResponse {
    data: Vec<RemoteModel>,
}

fn models_url(base_url: &str) -> String {
    format!("{}/models", base_url.trim_end_matches('/'))
}

/// Shared client: gateways' WAFs may throttle requests without a User-Agent;
/// HTTP/1.1 avoids h2 negotiation hangs seen with some providers.
fn http_client() -> reqwest::Client {
	reqwest::Client::builder()
		.user_agent(concat!("Yara/", env!("CARGO_PKG_VERSION")))
		.http1_only()
		.build()
		.expect("failed to build HTTP client")
}

pub async fn fetch_remote_models(
    base_url: &str,
    api_key: &str,
) -> Result<Vec<RemoteModel>, String> {
    let response = http_client()
        .get(models_url(base_url))
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Provider returned status {}", response.status()));
    }

    let body: ModelsResponse = response.json().await.map_err(|e| e.to_string())?;
    Ok(body.data)
}

pub async fn test_connection(base_url: &str, api_key: &str) -> Result<(), String> {
    let response = http_client()
        .get(models_url(base_url))
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("Provider returned status {}", response.status()))
    }
}
