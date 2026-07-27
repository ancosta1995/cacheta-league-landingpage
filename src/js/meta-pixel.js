let metaPixelConfig = null;
let pixelScriptRequested = false;

function whenFbqReady(callback) {
    if (typeof window.fbq === "function") {
        callback();
        return;
    }

    window.setTimeout(() => whenFbqReady(callback), 80);
}

function loadMetaPixelScript() {
    if (pixelScriptRequested || typeof window.fbq === "function") {
        return;
    }

    pixelScriptRequested = true;

    const inline = document.createElement("script");
    inline.textContent = `
      !function(f,b,e,v,n,t,s){
        if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)
      }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
    `;
    document.head.appendChild(inline);
}

function injectMetaPixelNoScript(pixelId) {
    if (!pixelId || document.getElementById("meta-pixel-noscript")) {
        return;
    }

    const noscript = document.createElement("noscript");
    noscript.id = "meta-pixel-noscript";
    noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1" alt="" />`;
    document.body.appendChild(noscript);
}

function trackMetaEvent(eventConfig) {
    if (!eventConfig?.name) return;

    whenFbqReady(() => {
        if (eventConfig.type === "standard") {
            window.fbq("track", eventConfig.name);
            return;
        }

        window.fbq("trackCustom", eventConfig.name);
    });
}

function initMetaPixel(config) {
    metaPixelConfig = config;

    if (!config?.pixelId) {
        return;
    }

    loadMetaPixelScript();
    injectMetaPixelNoScript(config.pixelId);

    whenFbqReady(() => {
        window.fbq("init", config.pixelId);

        if (config.pageView) {
            window.fbq("track", "PageView");
        }
    });
}

function trackMetaLead() {
    if (!metaPixelConfig?.leadEvent) {
        return;
    }

    trackMetaEvent(metaPixelConfig.leadEvent);
}
