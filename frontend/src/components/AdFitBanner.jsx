import { useEffect, useRef } from "react";

const ADFIT_SCRIPT_ID = "kakao-adfit-script";
const ADFIT_SCRIPT_SRC = "https://t1.kakaocdn.net/kas/static/ba.min.js";

export function AdFitBanner({ adUnit, width, height, className = "" }) {
  const shellRef = useRef(null);

  useEffect(() => {
    if (typeof document === "undefined" || !shellRef.current) return undefined;

    const existingScript = document.getElementById(ADFIT_SCRIPT_ID);
    if (existingScript) existingScript.remove();

    const script = document.createElement("script");
    script.id = ADFIT_SCRIPT_ID;
    script.async = true;
    script.type = "text/javascript";
    script.charset = "utf-8";
    script.src = ADFIT_SCRIPT_SRC;
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [adUnit, height, width]);

  return (
    <div ref={shellRef} className={className}>
      <ins
        className="kakao_ad_area"
        style={{ display: "none" }}
        data-ad-unit={adUnit}
        data-ad-width={String(width)}
        data-ad-height={String(height)}
      />
    </div>
  );
}
