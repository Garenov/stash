"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Bookmarklet открывает небольшое окно /save с уже заполненными адресом и названием
 * страницы. Токен в нём не нужен: окно работает от вашей сессии на этом сайте.
 */
export function Bookmarklet() {
  const ref = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    const js =
      `javascript:(()=>{window.open(${JSON.stringify(location.origin)}+'/save?url='+` +
      `encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),` +
      `'stash','width=480,height=640')})()`;
    // React блокирует javascript: в href, поэтому выставляем атрибут напрямую
    ref.current?.setAttribute("href", js);
    setCode(js);
  }, []);

  return (
    <div>
      <p>
        Перетащите кнопку на панель закладок браузера:{" "}
        <a ref={ref} className="button" onClick={(e) => e.preventDefault()}>
          + Сохранить в Stash
        </a>
      </p>
      <p className="muted">
        Нажимайте её на любой странице, чтобы сохранить. Если перетащить нельзя (телефон), создайте
        закладку вручную и вставьте в поле адреса:
      </p>
      <textarea readOnly rows={3} value={code} onFocus={(e) => e.currentTarget.select()} />
    </div>
  );
}
