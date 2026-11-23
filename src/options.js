/* global momentoLoadLanguage, t */
// 扩展设置页：选语言、看本机 Momento 能不能连上。

const MOMENTO = "http://127.0.0.1:47641";
const $ = (selector) => document.querySelector(selector);
// 最近一次检查结果，换语言时按新语言重写。
let lastStatus = { state: "checking" };

function render() {
  document.documentElement.lang = t("langCode");
  document.title = `${t("extName")} · ${t("optionsTitle")}`;
  for (const element of document.querySelectorAll("[data-text]")) {
    element.textContent = t(element.dataset.text);
  }
  const status = $("#status");
  const { state, version, error } = lastStatus;
  status.className = `status ${state === "ok" ? "ok" : state === "checking" ? "" : "bad"}`;
  status.querySelector(".text").textContent = {
    checking: t("optionsChecking"),
    ok: t("optionsConnected", version || "").trim(),
    unreachable: t("optionsUnreachable"),
    rejected: t("optionsRejected", error),
    notMomento: t("optionsNotMomento")
  }[state];
  $("#status-detail").textContent = { unreachable: t("optionsUnreachableHint"), notMomento: error }[state] || "";
}

async function check() {
  lastStatus = { state: "checking" };
  $("#recheck").disabled = true;
  render();
  try {
    const response = await fetch(`${MOMENTO}/api/v1/status`);
    let body;
    try {
      body = await response.json();
    } catch (error) {
      // 47641 上回的不是 Momento 的 JSON，多半是别的程序占了这个端口。
      lastStatus = { state: "notMomento", error: `HTTP ${response.status} · ${error.message}` };
      console.warn("Momento: 状态接口返回的不是 JSON", response.status, error);
      return;
    }
    if (response.ok && body.ok) {
      lastStatus = { state: "ok", version: body.version };
    } else {
      // 连上了但 Momento 不收：原样显示状态码和它给的原因。
      lastStatus = { state: "rejected", error: [`HTTP ${response.status}`, body.code, body.error].filter(Boolean).join(" · ") };
      console.warn("Momento: 状态检查被拒绝", response.status, body);
    }
  } catch (error) {
    lastStatus = { state: "unreachable" };
    console.warn("Momento: 连不上本机 Momento", error);
  } finally {
    $("#recheck").disabled = false;
    render();
  }
}

$("#language").addEventListener("change", async (event) => {
  $("#language-error").textContent = "";
  try {
    await chrome.storage.local.set({ language: event.target.value });
    await momentoLoadLanguage();
  } catch (error) {
    console.error("Momento: 保存语言设置失败", error);
    $("#language-error").textContent = t("optionsStorageFailed", error?.message || String(error));
  }
  render();
});

$("#recheck").addEventListener("click", check);

(async () => {
  $(".version").textContent = chrome.runtime.getManifest().version;
  try {
    $("#language").value = await momentoLoadLanguage();
  } catch (error) {
    console.error("Momento: 读取语言设置失败", error);
    $("#language-error").textContent = t("optionsStorageFailed", error?.message || String(error));
  }
  render();
  await check();
})();
