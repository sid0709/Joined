import Script from "next/script";

import { gaMeasurementId, gtmContainerId } from "@/lib/config";

const GTM_SCRIPT_ID = "joined-gtm";
const GA_LOADER_ID = "joined-ga-loader";
const GA_CONFIG_ID = "joined-ga-config";

/** GTM container + GA4 gtag for Search Console verification and analytics (when env is set). */
export function GoogleSiteTags() {
  const gtm = gtmContainerId();
  const ga = gaMeasurementId();

  if (!gtm && !ga) return null;

  return (
    <>
      {gtm ? (
        <Script id={GTM_SCRIPT_ID} strategy="beforeInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtm}');`}
        </Script>
      ) : null}
      {ga ? (
        <>
          <Script
            id={GA_LOADER_ID}
            src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}
            strategy="afterInteractive"
          />
          <Script id={GA_CONFIG_ID} strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());
gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
gtag('config','${ga}');`}
          </Script>
        </>
      ) : null}
    </>
  );
}

export function GoogleTagManagerNoScript() {
  const gtm = gtmContainerId();
  if (!gtm) return null;

  return (
    <noscript>
      <iframe
        title="Google Tag Manager"
        src={`https://www.googletagmanager.com/ns.html?id=${gtm}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
