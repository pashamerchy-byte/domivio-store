/* ==========================================================================
   DOMIVIO — Storefront Engine, Bilingual PL/EN Switcher, Cart & Apaczka Map
   Direct Shopify Checkout Sync with 1084d2-13.myshopify.com
   ========================================================================== */

(function () {
  "use strict";

  const CFG = window.DOMIVIO_CONFIG;
  const I18N = window.DOMIVIO_I18N;
  const PRODUCTS = window.DOMIVIO_PRODUCTS;

  // Detect default language: Polish for pl browsers or stored preference, English for others
  function detectInitialLang() {
    const saved = localStorage.getItem("domivio_lang");
    if (saved === "pl" || saved === "en") return saved;
    const navLang = (navigator.language || navigator.userLanguage || "pl").toLowerCase();
    return navLang.startsWith("pl") ? "pl" : "pl"; // Default PL, with 1-click EN toggle in header
  }

  let currentLang = detectInitialLang();
  let currentCategory = "all";
  let cart = loadCart();
  let activeDiscount = "";
  localStorage.removeItem("domivio_discount_unlocked");
  let selectedLocker = loadLocker();
  let selectedShippingMethod = localStorage.getItem("domivio_shipping_method") || "inpost_paczkomat";
  let activePdpProduct = null;
  let activePdpPackQty = 1;

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem("domivio_cart") || "[]");
      if (Array.isArray(raw) && raw.length > 0) return raw;
    } catch (e) {}
    return [];
  }

  function saveCart() {
    localStorage.setItem("domivio_cart", JSON.stringify(cart));
    renderCartUI();
  }

  function loadLocker() {
    try {
      return JSON.parse(localStorage.getItem("domivio_selected_locker") || "null");
    } catch (e) {
      return null;
    }
  }

  function saveLocker(lk) {
    selectedLocker = lk;
    if (lk && lk.code) {
      localStorage.setItem("domivio_selected_locker", JSON.stringify(lk));
      if (lk.supplier === "DPD") {
        selectedShippingMethod = "dpd_paczkomat";
      } else {
        selectedShippingMethod = "inpost_paczkomat";
      }
      localStorage.setItem("domivio_shipping_method", selectedShippingMethod);
    } else {
      localStorage.removeItem("domivio_selected_locker");
    }
    renderCartUI();
  }

  window.selectShippingMethod = function (methodId) {
    if (methodId === "inpost_paczkomat" || methodId === "dpd_paczkomat" || methodId === "kurier_dpd") {
      selectedShippingMethod = methodId;
      localStorage.setItem("domivio_shipping_method", selectedShippingMethod);
      renderCartUI();
    }
  };

  function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || I18N.pl[key] || key;
  }

  function formatMoney(amountPLN, amountEUR) {
    if (currentLang === "en") {
      const val = typeof amountEUR === "number" ? amountEUR : amountPLN / 4.25;
      return "€" + val.toFixed(2);
    }
    return amountPLN.toFixed(2).replace(".", ",") + " zł";
  }

  function getProductPrice(prod) {
    return currentLang === "en" ? prod.priceEUR : prod.pricePLN;
  }

  function getProductCompare(prod) {
    return currentLang === "en" ? prod.compareEUR : prod.comparePLN;
  }

  function formatValue(val) {
    if (currentLang === "en") return "€" + val.toFixed(2);
    return val.toFixed(2).replace(".", ",") + " zł";
  }

  // ── Language Switching ────────────────────────────────────────────────
  window.setDomivioLang = function (lang) {
    currentLang = lang === "en" ? "en" : "pl";
    localStorage.setItem("domivio_lang", currentLang);
    document.documentElement.lang = currentLang;

    document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-lang-btn") === currentLang);
    });

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) el.setAttribute("placeholder", t(key));
    });

    renderHeroPrice();
    renderCatalog();
    renderCartUI();
    updateWelcomePillUI();
    if (activePdpProduct) openProductModal(activePdpProduct.handle, activePdpPackQty);
  };

  function renderHeroPrice() {
    const mb = PRODUCTS.find((p) => p.isMysteryBox) || PRODUCTS[0];
    const nowEl = document.getElementById("heroPriceNow");
    const oldEl = document.getElementById("heroPriceOld");
    const bulletsEl = document.getElementById("heroCardBullets");
    const stickyPriceEl = document.getElementById("stickyBarPrice");
    const stickyTitleEl = document.getElementById("stickyBarTitle");
    const priceBoxEl = document.querySelector(".hero__price-box");
    const stickyBarEl = document.getElementById("stickyBottomBar");

    if (!mb) {
      if (priceBoxEl) priceBoxEl.style.display = "none";
      if (stickyBarEl) stickyBarEl.style.display = "none";
      if (bulletsEl) {
        bulletsEl.innerHTML =
          currentLang === "en"
            ? `<li>✦ Engineered for deep REM & slow-wave sleep recovery</li><li>✦ Minimalist, zero-distraction bedroom aesthetics</li><li>✦ Complimentary InPost & DPD Locker delivery from 99 PLN</li>`
            : `<li>✦ Zaprojektowane dla głębokiej fazy REM i regeneracji nocnej</li><li>✦ Minimalistyczna, wyciszająca estetyka sypialni</li><li>✦ Darmowa dostawa Paczkomatem InPost i DPD od 99 zł</li>`;
      }
      return;
    }

    if (priceBoxEl) priceBoxEl.style.display = "";
    if (stickyBarEl) stickyBarEl.style.display = "";
    if (nowEl) nowEl.textContent = formatValue(getProductPrice(mb));
    if (oldEl) oldEl.textContent = formatValue(getProductCompare(mb));
    if (bulletsEl) {
      bulletsEl.innerHTML = mb.bullets[currentLang]
        .map((b) => `<li>${b}</li>`)
        .join("");
    }
    if (stickyPriceEl) stickyPriceEl.textContent = formatValue(getProductPrice(mb));
    if (stickyTitleEl) stickyTitleEl.textContent = mb.title[currentLang];
  }

  // ── Hero Slider & Catalog Rendering (1:1 Darwin Sleep) ────────────────
  window.switchDarwinSlide = function (num) {
    const s1 = document.getElementById("dwHeroSlide1");
    const s2 = document.getElementById("dwHeroSlide2");
    if (!s1 || !s2) return;
    if (num === 2) {
      s1.style.display = "none";
      s2.style.display = "flex";
    } else {
      s1.style.display = "flex";
      s2.style.display = "none";
    }
  };

  window.filterCatalog = function (cat) {
    currentCategory = cat || "all";
    document.querySelectorAll("[data-filter-cat]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-filter-cat") === currentCategory);
    });
    renderCatalog();
  };

  function renderCatalog() {
    const grid = document.getElementById("productGrid");
    if (!grid) return;

    const list = PRODUCTS.filter((p) => {
      if (currentCategory === "all") return true;
      return p.category && p.category.includes(currentCategory);
    });

    grid.innerHTML = list
      .map((p) => {
        const price = getProductPrice(p);
        const comp = getProductCompare(p);
        const savePct = comp ? Math.round(((comp - price) / comp) * 100) : 0;
        const splitInstallment = Math.ceil(price / 4);
        const splitStr = currentLang === "en" ? "€" + splitInstallment : splitInstallment + " zł";
        const catLabel = currentLang === "en" ? (p.catLabelEN || "SLEEP") : (p.catLabelPL || "PODUSZKI");
        const specTop = currentLang === "en" ? (p.specTopEN || "") : (p.specTopPL || "");
        const badgesHtml = (p.badges || [])
          .map((b) => `<span class="dw-badge dw-badge--${b.type}">${b.text}</span>`)
          .join("");
        const sizesHtml =
          p.sizes && p.sizes.length > 0
            ? `
              <div class="dw-card__size-row">
                <span>${t("size_label")}</span>
                <select class="dw-card__size-select" aria-label="Rozmiar">
                  ${p.sizes.map((sz) => `<option value="${sz}">${sz}</option>`).join("")}
                </select>
              </div>
            `
            : "";

        return `
          <article class="dw-card">
            <div class="dw-card__box" onclick="openProductModal('${p.handle}')">
              <div class="dw-card__badges">
                ${badgesHtml}
                ${specTop ? `<div class="dw-card__spec">${specTop}</div>` : ""}
              </div>
              <img class="dw-card__img" src="${p.images[0]}" alt="${p.title[currentLang]}" loading="lazy" />
              <button type="button" class="dw-card__atc-overlay" onclick="event.stopPropagation(); addToCart(${p.variantId}, 1, true)">
                ${t("btn_add_to_cart")}
              </button>
            </div>
            <div class="dw-card__info">
              <div class="dw-card__cat">${catLabel}</div>
              <h3 class="dw-card__title" onclick="openProductModal('${p.handle}')">${p.title[currentLang]}</h3>
              <div class="dw-card__price-row">
                <span class="dw-card__price">${formatValue(price)}</span>
                ${comp ? `<span class="dw-card__old">${formatValue(comp)}</span>` : ""}
                ${savePct > 0 ? `<span class="dw-card__disc">-${savePct}%</span>` : ""}
              </div>
              <div class="dw-card__split">
                <span class="dw-card__split-pill">🌙 ${splitStr}</span>
                <span>${t("split_label")}</span>
              </div>
              ${sizesHtml}
            </div>
          </article>
        `;
      })
      .join("");
  }

  // ── Product Detail Modal & Quantity Bundles (1 / 2 -10% / 3 -15%) ──────
  window.openProductModal = function (handle, packQty) {
    const prod = PRODUCTS.find((p) => p.handle === handle);
    if (!prod) return;
    activePdpProduct = prod;
    activePdpPackQty = packQty || 1;

    const modal = document.getElementById("pdpModal");
    const content = document.getElementById("pdpModalContent");
    if (!modal || !content) return;

    const unitPrice = getProductPrice(prod);
    const unitComp = getProductCompare(prod);

    const p1 = unitPrice;
    const p2Orig = unitPrice * 2;
    const p2Disc = p2Orig * 0.9;
    const p3Orig = unitPrice * 3;
    const p3Disc = p3Orig * 0.85;

    const activeTotal =
      activePdpPackQty === 3 ? p3Disc : activePdpPackQty === 2 ? p2Disc : p1;

    const thumbsHtml =
      prod.images.length > 1
        ? `<div class="pdp-modal__thumbs">
            ${prod.images
              .map(
                (src, i) => `
              <div class="pdp-modal__thumb ${i === 0 ? "is-active" : ""}" onclick="switchPdpImage('${src}', this)">
                <img src="${src}" alt="">
              </div>
            `
              )
              .join("")}
          </div>`
        : "";

    const packsHtml = !prod.isDigital
      ? `
        <div class="qty-packs">
          <div class="qty-packs__header">${t("qty_header")}</div>
          <div class="qty-packs__grid">
            <button type="button" class="qty-pack ${activePdpPackQty === 1 ? "is-selected" : ""}" onclick="openProductModal('${prod.handle}', 1)">
              <span class="qty-pack__title">${t("qty_1_title")}</span>
              <span class="qty-pack__price">${formatValue(p1)}</span>
              <span class="qty-pack__note">${t("qty_1_note")}</span>
            </button>
            <button type="button" class="qty-pack ${activePdpPackQty === 2 ? "is-selected" : ""}" onclick="openProductModal('${prod.handle}', 2)">
              <span class="qty-pack__ribbon">${t("qty_2_ribbon")}</span>
              <span class="qty-pack__title">${t("qty_2_title")}</span>
              <span class="qty-pack__price">${formatValue(p2Disc)}</span>
              <span class="qty-pack__old">${formatValue(p2Orig)}</span>
              <span class="qty-pack__note">${t("qty_2_note")}</span>
            </button>
            <button type="button" class="qty-pack ${activePdpPackQty === 3 ? "is-selected" : ""}" onclick="openProductModal('${prod.handle}', 3)">
              <span class="qty-pack__ribbon">${t("qty_3_ribbon")}</span>
              <span class="qty-pack__title">${t("qty_3_title")}</span>
              <span class="qty-pack__price">${formatValue(p3Disc)}</span>
              <span class="qty-pack__old">${formatValue(p3Orig)}</span>
              <span class="qty-pack__note">${t("qty_3_note")}</span>
            </button>
          </div>
        </div>
      `
      : "";

    content.innerHTML = `
      <div class="pdp-modal__grid">
        <div>
          <div class="pdp-modal__main-img">
            <img id="pdpMainImg" src="${prod.images[0]}" alt="${prod.title[currentLang]}">
          </div>
          ${thumbsHtml}
        </div>
        <div>
          <div style="display:inline-block;background:#FFD600;border:1.5px solid #111;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:900;margin-bottom:8px;">
            ${currentLang === "en" ? prod.badgeEN : prod.badgePL}
          </div>
          <h2 style="font-size:22px;font-weight:900;line-height:1.25;margin-bottom:8px;">${prod.title[currentLang]}</h2>
          <div style="font-size:13px;font-weight:800;color:#D97706;margin-bottom:12px;">★★★★★ ${prod.rating} (${prod.reviewsCount})</div>
          <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:14px;">
            <span style="font-size:28px;font-weight:900;">${formatValue(activeTotal)}</span>
            ${unitComp ? `<span style="font-size:16px;color:#94A3B8;text-decoration:line-through;font-weight:700;">${formatValue(unitComp * activePdpPackQty)}</span>` : ""}
          </div>
          <p style="font-size:14px;color:#334155;margin-bottom:14px;">${prod.shortDesc[currentLang]}</p>
          <ul style="list-style:none;display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;margin-bottom:16px;">
            ${prod.bullets[currentLang].map((b) => `<li>${b}</li>`).join("")}
          </ul>
          ${packsHtml}
          <button type="button" class="btn-yellow" style="width:100%;margin-bottom:12px;" onclick="addToCart(${prod.variantId}, ${activePdpPackQty}, true); closeProductModal();">
            🛒 ${t("btn_add_to_cart")} — ${formatValue(activeTotal)}
          </button>
          <div style="background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:8px;padding:10px 12px;font-size:12px;display:flex;flex-direction:column;gap:4px;font-weight:700;">
            <div style="color:#16A34A;">● ${t("stock_in_stock")}</div>
            <div>🚚 ${t("trust_fast_ship")}</div>
            <div>📦 ${t("trust_locker")}</div>
            <div>🔒 ${t("trust_payments")}</div>
          </div>
        </div>
      </div>
    `;

    modal.classList.add("is-open");
  };

  window.switchPdpImage = function (src, thumbEl) {
    const img = document.getElementById("pdpMainImg");
    if (img) img.src = src;
    document.querySelectorAll(".pdp-modal__thumb").forEach((el) => el.classList.remove("is-active"));
    if (thumbEl) thumbEl.classList.add("is-active");
  };

  window.closeProductModal = function () {
    const modal = document.getElementById("pdpModal");
    if (modal) modal.classList.remove("is-open");
    activePdpProduct = null;
  };

  // ── Cart Operations ───────────────────────────────────────────────────
  window.addToCart = function (variantId, qty, openDrawer) {
    const prod = PRODUCTS.find((p) => p.variantId === Number(variantId));
    if (!prod) return;
    const addQty = Math.max(1, parseInt(qty, 10) || 1);

    const existing = cart.find((item) => item.variantId === prod.variantId);
    if (existing) {
      existing.qty += addQty;
    } else {
      cart.push({
        variantId: prod.variantId,
        handle: prod.handle,
        qty: addQty
      });
    }

    saveCart();
    showToastNotification();
    if (openDrawer) {
      openCartDrawer();
    }
  };

  window.updateCartQty = function (variantId, delta) {
    const idx = cart.findIndex((i) => i.variantId === Number(variantId));
    if (idx === -1) return;
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) {
      cart.splice(idx, 1);
    }
    saveCart();
  };

  window.openCartDrawer = function () {
    const dr = document.getElementById("cartDrawer");
    if (dr) dr.classList.add("is-open");
    renderCartUI();
  };

  window.closeCartDrawer = function () {
    const dr = document.getElementById("cartDrawer");
    if (dr) dr.classList.remove("is-open");
  };

  function getCartTotals() {
    let subtotal = 0;
    let totalCount = 0;
    cart.forEach((item) => {
      const prod = PRODUCTS.find((p) => p.variantId === item.variantId);
      if (!prod) return;
      const unit = getProductPrice(prod);
      let lineTotal = unit * item.qty;
      if (item.qty === 2) lineTotal = lineTotal * 0.9;
      else if (item.qty >= 3) lineTotal = lineTotal * 0.85;
      subtotal += lineTotal;
      totalCount += item.qty;
    });

    const discountAmount = 0;
    const totalAfterDiscount = subtotal;
    const threshold = currentLang === "en" ? (CFG.freeShippingEUR || 25.0) : (CFG.freeShippingPLN || 99.0);
    const remainingForFreeShip = Math.max(0, threshold - totalAfterDiscount);
    const progressPct = Math.min(100, (totalAfterDiscount / threshold) * 100);
    const isDigitalOnly =
      cart.length > 0 &&
      cart.every((item) => {
        const p = PRODUCTS.find((x) => x.variantId === item.variantId);
        return p && p.isDigital;
      });
    const isFreeLocker = isDigitalOnly || (totalAfterDiscount >= threshold && totalCount > 0);

    let shippingCost = 0;
    let shippingMethodLabel = "";
    if (totalCount > 0) {
      if (isDigitalOnly) {
        shippingCost = 0;
        shippingMethodLabel = currentLang === "en" ? "Instant PDF Email Delivery" : "Wysyłka PDF na e-mail (0 zł)";
      } else if (selectedShippingMethod === "kurier_dpd") {
        shippingCost = currentLang === "en" ? 4.70 : 19.90;
        shippingMethodLabel = currentLang === "en" ? "Kurier DPD" : "Kurier DPD";
      } else if (selectedShippingMethod === "dpd_paczkomat") {
        shippingCost = isFreeLocker ? 0 : (currentLang === "en" ? 3.50 : 14.90);
        shippingMethodLabel = "DPD Paczkomaty";
      } else {
        shippingCost = isFreeLocker ? 0 : (currentLang === "en" ? 3.50 : 14.90);
        shippingMethodLabel = "InPost Paczkomaty";
      }
    }

    const grandTotal = totalAfterDiscount + shippingCost;

    return {
      subtotal,
      discountAmount,
      totalAfterDiscount,
      shippingCost,
      shippingMethodLabel,
      isFreeLocker,
      grandTotal,
      totalCount,
      threshold,
      remainingForFreeShip,
      progressPct
    };
  }

  function showToastNotification() {
    const toast = document.getElementById("cartToast");
    const msg = document.getElementById("cartToastMsg");
    if (!toast || !msg) return;
    const totals = getCartTotals();
    if (totals.remainingForFreeShip > 0) {
      msg.innerHTML =
        currentLang === "en"
          ? `Added to cart! Only <strong>${formatValue(totals.remainingForFreeShip)}</strong> away from FREE Locker shipping!`
          : `Dodano do koszyka! Do darmowej dostawy Paczkomatem brakuje tylko <strong>${formatValue(totals.remainingForFreeShip)}</strong>`;
    } else {
      msg.innerHTML = `<strong>${t("shipping_bar_unlocked")}</strong>`;
    }
    toast.classList.add("is-visible");
    clearTimeout(window._domivioToastTimer);
    window._domivioToastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 4000);
  }

  function renderCartUI() {
    const totals = getCartTotals();
    const countBadge = document.getElementById("headerCartCount");
    if (countBadge) countBadge.textContent = String(totals.totalCount);

    // Free Shipping Bar (for InPost / DPD Paczkomaty from 99 PLN)
    const shipLabel = document.getElementById("shipBarLabel");
    const shipFill = document.getElementById("shipBarFill");
    if (shipLabel && shipFill) {
      shipFill.style.width = totals.progressPct + "%";
      if (totals.remainingForFreeShip > 0) {
        shipLabel.innerHTML =
          currentLang === "en"
            ? `${t("shipping_bar_pre")}<strong>${formatValue(totals.remainingForFreeShip)}</strong> away from FREE Locker shipping!`
            : `${t("shipping_bar_pre")}<strong>${formatValue(totals.remainingForFreeShip)}</strong>!`;
      } else {
        shipLabel.innerHTML = `<span style="color:#16A34A;">${t("shipping_bar_unlocked")}</span>`;
      }
    }

    const itemsWrap = document.getElementById("cartItemsContainer");
    const upsellWrap = document.getElementById("cartUpsellsContainer");
    const footerWrap = document.getElementById("cartDrawerFooter");
    if (!itemsWrap || !upsellWrap || !footerWrap) return;

    if (cart.length === 0) {
      itemsWrap.innerHTML = `
        <div style="text-align:center;padding:40px 16px;">
          <div style="font-size:42px;margin-bottom:10px;">🛒</div>
          <p style="font-weight:800;margin-bottom:16px;">${t("cart_empty")}</p>
          <button type="button" class="btn-yellow" onclick="addToCart(${CFG.mysteryBoxVariantId}, 1, false)">
            ${t("cart_empty_cta")}
          </button>
        </div>
      `;
      upsellWrap.innerHTML = "";
      footerWrap.style.display = "none";
      return;
    }

    footerWrap.style.display = "block";

    // Render cart items
    itemsWrap.innerHTML = cart
      .map((item) => {
        const prod = PRODUCTS.find((p) => p.variantId === item.variantId);
        if (!prod) return "";
        const unit = getProductPrice(prod);
        let lineTotal = unit * item.qty;
        let packBadge = "";
        if (item.qty === 2) {
          lineTotal *= 0.9;
          packBadge = `<span style="background:#FFD600;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:900;margin-left:6px;">-10% PAKIET</span>`;
        } else if (item.qty >= 3) {
          lineTotal *= 0.85;
          packBadge = `<span style="background:#FFD600;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:900;margin-left:6px;">-15% PAKIET</span>`;
        }

        return `
          <div class="cart-item">
            <img class="cart-item__img" src="${prod.images[0]}" alt="${prod.title[currentLang]}">
            <div>
              <div class="cart-item__title">${prod.title[currentLang]}</div>
              <div class="cart-item__price">${formatValue(lineTotal)} ${packBadge}</div>
              <div class="cart-item__qty-ctrl">
                <button type="button" class="cart-item__qty-btn" onclick="updateCartQty(${prod.variantId}, -1)">−</button>
                <span class="cart-item__qty-val">${item.qty}</span>
                <button type="button" class="cart-item__qty-btn" onclick="updateCartQty(${prod.variantId}, 1)">+</button>
              </div>
            </div>
            <button type="button" style="background:transparent;border:none;font-size:16px;font-weight:900;color:#94A3B8;" onclick="updateCartQty(${prod.variantId}, -999)">✕</button>
          </div>
        `;
      })
      .join("");

    // Render 1-Click Second Product Order Bump + 3-Option Shipping Selector + Interactive Locker Map
    const otherProd =
      PRODUCTS.find((p) => p.isDigital && !cart.some((i) => i.variantId === p.variantId)) ||
      PRODUCTS.find((p) => !cart.some((i) => i.variantId === p.variantId));

    const mysteryBumpHtml = otherProd
      ? `
        <div class="mystery-bump">
          <div class="mystery-bump__top">
            <span class="mystery-bump__tag">${otherProd.isDigital ? (currentLang === "en" ? "👶 BABY PARENTS E-BOOK (PDF)" : "👶 PORADNIK DLA RODZICÓW NIEMOWLĄT (PDF)") : t("mystery_upsell_tag")}</span>
            <span class="mystery-bump__save">${otherProd.isDigital ? (currentLang === "en" ? "-49% · PDF" : "-49% · WYSYŁKA PDF") : t("mystery_upsell_save")}</span>
          </div>
          <div class="mystery-bump__row">
            <img class="mystery-bump__img" src="${otherProd.images[0]}" alt="">
            <div>
              <div style="font-size:13px;font-weight:900;line-height:1.25;">${otherProd.title[currentLang]}</div>
              <div style="font-size:11.5px;color:#334155;">${otherProd.isDigital ? (currentLang === "en" ? "Gentle baby sleep routines & first-year development guide — instant PDF!" : "Sprawdzone rytuały usypiania niemowląt i skoki rozwojowe — natychmiast na e-mail!") : t("mystery_upsell_desc")}</div>
            </div>
          </div>
          <button type="button" class="mystery-bump__btn" onclick="addToCart(${otherProd.variantId}, 1, false)">
            ${t("mystery_upsell_btn")} (${formatValue(getProductPrice(otherProd))})
          </button>
        </div>
      `
      : "";

    const lockerPriceBase = currentLang === "en" ? "€3.50" : "14,90 zł";
    const courierPriceStr = currentLang === "en" ? "€4.70" : "19,90 zł";
    const lockerPriceDisplay = totals.isFreeLocker
      ? `<span style="color:#16A34A;font-weight:900;">0,00 zł (GRATIS)</span> <span style="text-decoration:line-through;color:#94A3B8;font-size:11px;">${lockerPriceBase}</span>`
      : `<span style="font-weight:900;">${lockerPriceBase}</span>`;

    const selectedPointHtml =
      selectedLocker && selectedLocker.code && selectedShippingMethod !== "kurier_dpd"
        ? `
          <div class="locker-selected" style="margin-top:8px;">
            <div>
              <span class="locker-selected__badge">${selectedLocker.supplier === "INPOST" ? "INPOST PACZKOMATY" : "DPD PACZKOMATY"}</span>
              <div style="font-size:13px;font-weight:900;">${selectedLocker.code}</div>
              <div style="font-size:11.5px;color:#475569;">${selectedLocker.street}, ${selectedLocker.postal_code} ${selectedLocker.city}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <button type="button" class="acc-card__btn" onclick="openApaczkaLockerMap('${selectedLocker.supplier || "ALL"}')">${t("locker_change_btn")}</button>
              <button type="button" style="background:none;border:none;font-size:10.5px;font-weight:800;color:#DC2626;" onclick="clearSelectedLocker()">${t("locker_remove_btn")}</button>
            </div>
          </div>
        `
        : "";

    const lockerHtml = `
      <div class="locker-box">
        <div class="locker-box__title">${t("locker_title")}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div
            onclick="selectShippingMethod('inpost_paczkomat')"
            style="border:2px solid ${selectedShippingMethod === "inpost_paczkomat" ? "#111111" : "#CBD5E1"};background:${selectedShippingMethod === "inpost_paczkomat" ? "#FEF9C3" : "#FFFFFF"};border-radius:8px;padding:10px 12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;"
          >
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="radio" name="dom_ship_method" ${selectedShippingMethod === "inpost_paczkomat" ? "checked" : ""} style="accent-color:#111111;width:16px;height:16px;" />
              <div>
                <div style="font-size:13px;font-weight:900;color:#111111;">📦 InPost Paczkomaty</div>
                <button type="button" onclick="event.stopPropagation(); selectShippingMethod('inpost_paczkomat'); openApaczkaLockerMap('INPOST');" style="background:none;border:none;padding:0;font-size:11px;font-weight:800;color:#D97706;text-decoration:underline;">
                  ${t("locker_inpost_sub")}
                </button>
              </div>
            </div>
            <div style="text-align:right;font-size:12.5px;white-space:nowrap;">${lockerPriceDisplay}</div>
          </div>

          <div
            onclick="selectShippingMethod('dpd_paczkomat')"
            style="border:2px solid ${selectedShippingMethod === "dpd_paczkomat" ? "#111111" : "#CBD5E1"};background:${selectedShippingMethod === "dpd_paczkomat" ? "#FEF9C3" : "#FFFFFF"};border-radius:8px;padding:10px 12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;"
          >
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="radio" name="dom_ship_method" ${selectedShippingMethod === "dpd_paczkomat" ? "checked" : ""} style="accent-color:#111111;width:16px;height:16px;" />
              <div>
                <div style="font-size:13px;font-weight:900;color:#111111;">📦 DPD Paczkomaty</div>
                <button type="button" onclick="event.stopPropagation(); selectShippingMethod('dpd_paczkomat'); openApaczkaLockerMap('DPD');" style="background:none;border:none;padding:0;font-size:11px;font-weight:800;color:#D97706;text-decoration:underline;">
                  ${t("locker_dpd_sub")}
                </button>
              </div>
            </div>
            <div style="text-align:right;font-size:12.5px;white-space:nowrap;">${lockerPriceDisplay}</div>
          </div>

          <div
            onclick="selectShippingMethod('kurier_dpd')"
            style="border:2px solid ${selectedShippingMethod === "kurier_dpd" ? "#111111" : "#CBD5E1"};background:${selectedShippingMethod === "kurier_dpd" ? "#FEF9C3" : "#FFFFFF"};border-radius:8px;padding:10px 12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;"
          >
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="radio" name="dom_ship_method" ${selectedShippingMethod === "kurier_dpd" ? "checked" : ""} style="accent-color:#111111;width:16px;height:16px;" />
              <div>
                <div style="font-size:13px;font-weight:900;color:#111111;">🚚 Kurier DPD</div>
                <div style="font-size:11px;color:#475569;font-weight:600;">${t("locker_courier_sub")}</div>
              </div>
            </div>
            <div style="text-align:right;font-size:13px;font-weight:900;white-space:nowrap;">${courierPriceStr}</div>
          </div>
        </div>
        ${selectedPointHtml}
      </div>
    `;

    upsellWrap.innerHTML = mysteryBumpHtml + lockerHtml;

    // Summary totals
    document.getElementById("summarySubtotal").textContent = formatValue(totals.subtotal);
    const discRow = document.getElementById("summaryDiscountRow");
    if (discRow) discRow.style.display = "none";

    const shipEl = document.getElementById("summaryShipping");
    if (shipEl) {
      if (totals.shippingCost === 0 && totals.isFreeLocker) {
        shipEl.innerHTML = `<span style="color:#16A34A;font-weight:900;">${totals.shippingMethodLabel}: 0,00 zł (GRATIS od 99 zł)</span>`;
      } else {
        shipEl.textContent = `${totals.shippingMethodLabel}: ${formatValue(totals.shippingCost)}`;
      }
    }
    document.getElementById("summaryTotal").textContent = formatValue(totals.grandTotal);
  }

  window.clearSelectedLocker = function () {
    saveLocker(null);
  };

  window.applyManualDiscount = function () {};

  // ── Direct Shopify Cart Permalink Checkout (Passes Variants + Shipping Method + Paczkomat) ──
  window.proceedToShopifyCheckout = function () {
    if (cart.length === 0) return;
    const pairs = cart
      .map((i) => {
        const prod = PRODUCTS.find((p) => p.variantId === i.variantId);
        const realVid = (prod && prod.shopifyVariantId) || i.variantId;
        return `${realVid}:${i.qty}`;
      })
      .join(",");
    const params = new URLSearchParams();
    const totals = getCartTotals();

    params.set(
      "attributes[Sposób dostawy]",
      `${totals.shippingMethodLabel} (${totals.shippingCost === 0 ? "0,00 zł GRATIS od 99 zł" : formatValue(totals.shippingCost)})`
    );

    if (selectedLocker && selectedLocker.code && selectedShippingMethod !== "kurier_dpd") {
      const companyVal = `${selectedLocker.supplier} ${selectedLocker.code} (${selectedLocker.street}, ${selectedLocker.city})`;
      const addr2Val = `Paczkomat / Punkt: ${selectedLocker.code}`;
      params.set("checkout[shipping_address][company]", companyVal);
      params.set("checkout[shipping_address][address2]", addr2Val);
      params.set(
        "attributes[Punkt odbioru]",
        `${selectedLocker.supplier} ${selectedLocker.code} — ${selectedLocker.street}, ${selectedLocker.postal_code} ${selectedLocker.city}`
      );
      params.set("attributes[Kod punktu]", selectedLocker.code);
      params.set("attributes[Przewoźnik]", selectedLocker.supplier);
    }

    if (currentLang === "en") {
      params.set("locale", "en");
    } else {
      params.set("locale", "pl");
    }
    params.set("attributes[Sklep]", "DOMIVIO");

    const checkoutHost = CFG.myshopifyDomain || CFG.shopDomain;
    const checkoutUrl = `https://${checkoutHost}/cart/${pairs}?${params.toString()}`;
    window.location.href = checkoutUrl;
  };

  function updateWelcomePillUI() {
    const pill = document.getElementById("welcomePill");
    if (pill) pill.style.display = "none";
  }

  window.openExitModal = function () {};
  window.closeExitModal = function () {};
  window.dismissWelcomePill = function () {};
  window.submitExitDiscountForm = function (ev) {
    if (ev) ev.preventDefault();
    return false;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 4. INTERACTIVE INPOST & DPD MAP PICKER (Apaczka Map + Dual-Engine ArcGIS & Locker Autocomplete)
  // Exact port from Aeterna theme with yellow/black Domivio styling
  // ══════════════════════════════════════════════════════════════════════════
  let apaczkaMapInstance = null;
  let reopenDrawerAfterMap = false;
  let currentCarrierFilter = "ALL";

  function injectMapStyles() {
    if (document.getElementById("domivio-apaczka-styles")) return;
    const st = document.createElement("style");
    st.id = "domivio-apaczka-styles";
    st.textContent = `
      .apaczkaMapWrapper { z-index: 2147483647 !important; }
      .apaczkaMapWrapper img { width: auto; height: auto; max-width: none; display: inline-block; }
      .apaczkaMapWrapper .apaczkaCellIcon { width: 64px !important; height: 40px !important; object-fit: contain !important; }
      .apaczkaMapWrapper .popupLogo img { width: 88px !important; height: auto !important; object-fit: contain !important; }
      .apaczkaMapFilterCod, .apaczkaMapWrapper .popupServices, .apaczkaMapWrapper .apaczkaMapFilter, .apaczkaMapWrapper .apaczkaMapLogo { display: none !important; }
      .apaczkaMapWrapper .apaczkaMapRow1 {
        display: flex !important; flex-wrap: wrap !important; align-items: center !important;
        justify-content: space-between !important; gap: 10px !important; padding: 12px 14px !important;
        background: #FFFDF7 !important; border-bottom: 2px solid #111111 !important;
        height: auto !important; min-height: 64px !important; box-sizing: border-box !important; overflow: visible !important;
      }
      .apaczkaMapWrapper .apaczkaMapMobileHide { overflow: visible !important; }
      .apaczkaMapWrapper .apaczkaMapSearch {
        position: relative !important; flex: 1 1 320px !important; width: auto !important;
        max-width: 520px !important; margin: 0 !important; float: none !important; overflow: visible !important;
      }
      .apaczkaMapWrapper .apaczkaMapSearch input[name="search"] {
        width: 100% !important; height: 42px !important; padding: 0 64px 0 12px !important;
        border: 2px solid #111111 !important; border-radius: 8px !important;
        font-size: 13.5px !important; font-weight: 600 !important; color: #111111 !important;
        background: #ffffff !important; box-sizing: border-box !important; outline: none !important;
      }
      .dom-map-header-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .dom-map-carrier-tab {
        appearance: none; border: 2px solid #111111; background: #ffffff; color: #111111;
        padding: 9px 13px; font-size: 11px; font-weight: 800; text-transform: uppercase;
        cursor: pointer; border-radius: 8px; line-height: 1;
      }
      .dom-map-carrier-tab.is-active { background: #FFD600 !important; color: #111111 !important; box-shadow: 2px 2px 0 #111111; }
      .dom-map-close-desktop {
        appearance: none; border: 2px solid #111111; background: #111111; color: #FFD600;
        padding: 9px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase;
        cursor: pointer; border-radius: 8px; line-height: 1;
      }
      .dom-map-autocomplete {
        position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #ffffff;
        border: 2px solid #111111; border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.25);
        z-index: 2147483647; max-height: 360px; overflow-y: auto; display: none; text-align: left;
      }
      .dom-map-autocomplete.is-open { display: block; }
      .dom-map-ac-section {
        padding: 6px 10px; background: #FEF9C3; border-bottom: 1.5px solid #111111;
        font-size: 10px; font-weight: 900; text-transform: uppercase; color: #111111;
      }
      .dom-map-ac-item {
        padding: 9px 12px; border-bottom: 1px solid #eeeeee; cursor: pointer;
        display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #ffffff;
      }
      .dom-map-ac-item:hover { background: #FFFBEB; }
      .dom-map-ac-main { font-size: 12.5px; font-weight: 800; color: #111111; }
      .dom-map-ac-sub { font-size: 11px; color: #64748B; }
      .dom-map-ac-pick-btn {
        background: #FFD600; color: #111111; border: 1.5px solid #111111; border-radius: 6px;
        padding: 5px 9px; font-size: 10px; font-weight: 900; text-transform: uppercase; cursor: pointer;
      }
      .apaczkaMapWrapper .popupButtons a {
        background: #FFD600 !important; color: #111111 !important; border: 2px solid #111111 !important;
        border-radius: 8px !important; font-weight: 900 !important; text-transform: uppercase !important;
      }
    `;
    document.head.appendChild(st);
  }

  function loadApaczkaScript() {
    return new Promise((resolve, reject) => {
      if (typeof window.ApaczkaMap !== "undefined") return resolve();
      const existing = document.querySelector("script[data-domivio-apaczka]");
      if (existing) {
        existing.addEventListener("load", () => resolve());
        return;
      }
      const s = document.createElement("script");
      s.src = "https://mapa.apaczka.pl/client/apaczka.map.js";
      s.setAttribute("data-domivio-apaczka", "1");
      s.onload = () => resolve();
      s.onerror = (err) => reject(err);
      document.head.appendChild(s);
    });
  }

  function updateCarrierTabsUI(carrierMode) {
    currentCarrierFilter = carrierMode || "ALL";
    if (!apaczkaMapInstance || !apaczkaMapInstance.elementWrapper) return;
    apaczkaMapInstance.elementWrapper.querySelectorAll("[data-dom-carrier-tab]").forEach((btn) => {
      const c = btn.getAttribute("data-dom-carrier-tab");
      btn.classList.toggle("is-active", c === currentCarrierFilter);
      const labelBase =
        c === "INPOST" ? "📦 InPost Paczkomat" : c === "DPD" ? "📦 DPD Pickup" : "Wszystkie";
      btn.textContent = c === currentCarrierFilter ? `✓ ${labelBase}` : labelBase;
    });
  }

  function applyCarrierFilterToMap(carrierMode, triggerReload = true) {
    currentCarrierFilter = carrierMode || "ALL";
    updateCarrierTabsUI(currentCarrierFilter);
    if (!apaczkaMapInstance) return;
    const activeSuppliers =
      currentCarrierFilter === "INPOST"
        ? ["INPOST"]
        : currentCarrierFilter === "DPD"
        ? ["DPD"]
        : ["INPOST", "DPD"];
    apaczkaMapInstance.filter_supplier_allowed = ["INPOST", "DPD"];
    apaczkaMapInstance.filter_supplier = activeSuppliers.slice();
    if (triggerReload && apaczkaMapInstance.map && apaczkaMapInstance.table) {
      apaczkaMapInstance.fetchMode = "map";
      if (!apaczkaMapInstance.bounds) {
        apaczkaMapInstance.bounds = apaczkaMapInstance.map.getCenter().toBounds(50000);
      }
      apaczkaMapInstance.hidePopup();
      apaczkaMapInstance.loadData();
    }
  }

  function parseArcgisSuggestion(s) {
    const raw = (s.text || "").replace(/,\s*POL$/i, "").replace(/,\s*Polska$/i, "").trim();
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    const main = parts.slice(0, 2).join(", ") || raw;
    const sub = parts.slice(2).join(" · ") || "Polska";
    const hasStreetOrPostal = /\d/.test(raw) || parts.length >= 3;
    return {
      type: "address",
      main,
      sub,
      fullText: s.text || raw,
      magicKey: s.magicKey || "",
      hasRoad: hasStreetOrPostal
    };
  }

  async function resolveArcgisCoords(item) {
    try {
      const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&magicKey=${encodeURIComponent(
        item.magicKey || ""
      )}&SingleLine=${encodeURIComponent(item.fullText || item.main)}&countryCode=POL&maxLocations=1`;
      const resp = await fetch(url);
      const data = await resp.json();
      const cand = data && data.candidates && data.candidates[0];
      if (cand && cand.location) {
        return { lat: parseFloat(cand.location.y), lon: parseFloat(cand.location.x) };
      }
    } catch (e) {}
    return null;
  }

  async function fetchMatchingLockers(query, signal) {
    if (!query || query.length < 3) return [];
    const activeSuppliers =
      currentCarrierFilter === "INPOST"
        ? ["INPOST"]
        : currentCarrierFilter === "DPD"
        ? ["DPD"]
        : ["INPOST", "DPD"];
    const words = query.split(/\s+/).filter((w) => w.length >= 2).slice(0, 3);
    if (!words.length) return [];

    const fields = ["foreign_access_point_id", "name", "street", "house_number", "city", "postal_code"];
    const wordCriteria = words.map((w) => ({
      operator: "or",
      criteria: fields.map((f) => ({ field: f, operator: "contains", value: w }))
    }));

    const payload = {
      dataSource: "access_points",
      app_id: CFG.apaczkaAppId,
      operationType: "fetch",
      data: {
        operator: "and",
        criteria: [
          { field: "country_code", operator: "eq", value: "PL" },
          { field: "supplier", operator: "in", value: activeSuppliers },
          ...wordCriteria
        ]
      },
      orderBy: "name"
    };

    const resp = await fetch("https://mapa.apaczka.pl/access_points/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal
    });
    const json = await resp.json();
    const list = (json && json.data) || [];
    return list.slice(0, 4).map((p) => ({
      type: "locker",
      record: p,
      code: p.foreign_access_point_id || "",
      supplier: p.supplier || "PUNKT",
      street: [p.street || "", p.house_number || ""].join(" ").trim(),
      postal_code: p.postal_code || "",
      city: p.city || "",
      lat: parseFloat(p.latitude),
      lon: parseFloat(p.longitude)
    }));
  }

  function flyMapToLocation(lat, lon, hasRoad, labelText) {
    if (!apaczkaMapInstance || !apaczkaMapInstance.map) return;
    if (labelText && apaczkaMapInstance.elementSearch) {
      apaczkaMapInstance.elementSearch.value = labelText;
    }
    apaczkaMapInstance.fetchMode = "map";
    const targetZoom = hasRoad ? 15 : 13;
    const latLng = window.L ? new window.L.LatLng(lat, lon) : [lat, lon];
    if (latLng && typeof latLng.toBounds === "function") {
      apaczkaMapInstance.bounds = latLng.toBounds(50000);
    }
    apaczkaMapInstance.map.flyTo(latLng, targetZoom, { animate: false });
    apaczkaMapInstance.loadData();
  }

  function enhanceApaczkaModalDOM() {
    if (!apaczkaMapInstance || !apaczkaMapInstance.elementWrapper) return;
    const wrapper = apaczkaMapInstance.elementWrapper;
    if (wrapper.getAttribute("data-dom-enhanced") === "1") return;
    wrapper.setAttribute("data-dom-enhanced", "1");

    apaczkaMapInstance.hideServicesCod = true;
    apaczkaMapInstance.filter_services_cod = false;
    const origLoadData = apaczkaMapInstance.loadData.bind(apaczkaMapInstance);
    apaczkaMapInstance.loadData = function (cb) {
      if (this.map && !this.bounds) {
        this.bounds = this.map.getCenter().toBounds(50000);
      }
      return origLoadData(cb);
    };

    const row1 = wrapper.querySelector(".apaczkaMapRow1");
    if (row1) {
      const controls = document.createElement("div");
      controls.className = "dom-map-header-controls";
      controls.innerHTML = `
        <button type="button" class="dom-map-carrier-tab" data-dom-carrier-tab="INPOST">📦 InPost Paczkomat</button>
        <button type="button" class="dom-map-carrier-tab" data-dom-carrier-tab="DPD">📦 DPD Pickup</button>
        <button type="button" class="dom-map-carrier-tab" data-dom-carrier-tab="ALL">Wszystkie</button>
        <button type="button" class="dom-map-close-desktop" data-dom-map-close>✕ Zamknij</button>
      `;
      row1.appendChild(controls);

      controls.querySelectorAll("[data-dom-carrier-tab]").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          applyCarrierFilterToMap(btn.getAttribute("data-dom-carrier-tab"), true);
        });
      });

      controls.querySelector("[data-dom-map-close]").addEventListener("click", (ev) => {
        ev.preventDefault();
        apaczkaMapInstance.hide();
      });
    }

    const searchBox = wrapper.querySelector(".apaczkaMapSearch");
    const searchInput = apaczkaMapInstance.elementSearch;
    if (searchBox && searchInput) {
      searchInput.setAttribute(
        "placeholder",
        "Wpisz miasto, ulicę z numerem lub kod (np. Warszawa Marszałkowska 10)..."
      );
      searchInput.setAttribute("autocomplete", "off");

      const dropdown = document.createElement("div");
      dropdown.className = "dom-map-autocomplete";
      searchBox.appendChild(dropdown);

      let debounceTimer = null;
      let abortCtrl = null;

      searchInput.addEventListener("input", () => {
        const q = (searchInput.value || "").trim();
        if (debounceTimer) clearTimeout(debounceTimer);
        if (q.length < 2) {
          dropdown.classList.remove("is-open");
          return;
        }
        debounceTimer = setTimeout(async () => {
          try {
            if (abortCtrl) abortCtrl.abort();
            abortCtrl = new AbortController();
            const cat = encodeURIComponent("Address,Street Name,Postal,Populated Place");
            const suggestUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?f=json&countryCode=POL&category=${cat}&maxSuggestions=5&text=${encodeURIComponent(
              q
            )}`;

            const [addrRes, lockerRes] = await Promise.allSettled([
              fetch(suggestUrl, { signal: abortCtrl.signal }).then((r) => r.json()),
              fetchMatchingLockers(q, abortCtrl.signal)
            ]);

            const addrList =
              addrRes.status === "fulfilled" && addrRes.value && addrRes.value.suggestions
                ? addrRes.value.suggestions.slice(0, 4).map(parseArcgisSuggestion)
                : [];
            const lockerList = lockerRes.status === "fulfilled" ? lockerRes.value || [] : [];

            if (!addrList.length && !lockerList.length) {
              dropdown.classList.remove("is-open");
              return;
            }

            let html = "";
            if (addrList.length > 0) {
              html += `<div class="dom-map-ac-section">📍 ADRESY I ULICE</div>`;
              addrList.forEach((it, i) => {
                html += `<div class="dom-map-ac-item" data-ac-addr="${i}">
                  <div><div class="dom-map-ac-main">📍 ${it.main}</div><div class="dom-map-ac-sub">${it.sub}</div></div>
                  <span class="dom-map-ac-pick-btn">POKAŻ →</span>
                </div>`;
              });
            }
            if (lockerList.length > 0) {
              html += `<div class="dom-map-ac-section">📦 AUTOMATY PACZKOWE</div>`;
              lockerList.forEach((lk, j) => {
                html += `<div class="dom-map-ac-item" data-ac-lk="${j}">
                  <div><div class="dom-map-ac-main">[${lk.supplier}] ${lk.code} — ${lk.street}</div><div class="dom-map-ac-sub">${lk.postal_code} ${lk.city}</div></div>
                  <button type="button" class="dom-map-ac-pick-btn">WYBIERZ ✓</button>
                </div>`;
              });
            }

            dropdown.innerHTML = html;
            dropdown.classList.add("is-open");

            dropdown.querySelectorAll("[data-ac-addr]").forEach((el) => {
              el.addEventListener("mousedown", async (ev) => {
                ev.preventDefault();
                const chosen = addrList[parseInt(el.getAttribute("data-ac-addr"), 10)];
                dropdown.classList.remove("is-open");
                if (!chosen) return;
                const coords = await resolveArcgisCoords(chosen);
                if (coords) flyMapToLocation(coords.lat, coords.lon, chosen.hasRoad, chosen.main);
              });
            });

            dropdown.querySelectorAll("[data-ac-lk]").forEach((el) => {
              el.addEventListener("mousedown", (ev) => {
                ev.preventDefault();
                const lk = lockerList[parseInt(el.getAttribute("data-ac-lk"), 10)];
                dropdown.classList.remove("is-open");
                if (!lk) return;
                saveLocker({
                  code: lk.code,
                  supplier: lk.supplier,
                  street: lk.street,
                  postal_code: lk.postal_code,
                  city: lk.city
                });
                apaczkaMapInstance.hide();
              });
            });
          } catch (e) {}
        }, 160);
      });
    }
  }

  window.openApaczkaLockerMap = async function (requestedCarrier) {
    const dr = document.getElementById("cartDrawer");
    if (dr && dr.classList.contains("is-open")) {
      reopenDrawerAfterMap = true;
      closeCartDrawer();
    } else {
      reopenDrawerAfterMap = false;
    }

    try {
      injectMapStyles();
      await loadApaczkaScript();
      if (!apaczkaMapInstance) {
        apaczkaMapInstance = new window.ApaczkaMap({
          app_id: CFG.apaczkaAppId,
          hideServicesCod: true,
          onChange: function (record) {
            if (!record) return;
            saveLocker({
              code: record.foreign_access_point_id || "",
              supplier: record.supplier || "PUNKT",
              street: [record.street || "", record.house_number || ""].join(" ").trim(),
              postal_code: record.postal_code || "",
              city: record.city || ""
            });
          }
        });
        apaczkaMapInstance.setFilterSupplierAllowed(["INPOST", "DPD"], ["INPOST", "DPD"]);
        const origHide = apaczkaMapInstance.hide.bind(apaczkaMapInstance);
        apaczkaMapInstance.hide = function () {
          origHide();
          if (reopenDrawerAfterMap) {
            reopenDrawerAfterMap = false;
            setTimeout(() => openCartDrawer(), 80);
          }
        };
      }
      const initCarrier =
        requestedCarrier === "INPOST" || requestedCarrier === "DPD" ? requestedCarrier : "ALL";
      const initSuppliers =
        initCarrier === "INPOST" ? ["INPOST"] : initCarrier === "DPD" ? ["DPD"] : ["INPOST", "DPD"];
      const mapAlreadyReady = Boolean(apaczkaMapInstance.map);
      apaczkaMapInstance.filter_supplier_allowed = ["INPOST", "DPD"];
      apaczkaMapInstance.filter_supplier = initSuppliers.slice();
      apaczkaMapInstance.show();
      enhanceApaczkaModalDOM();
      applyCarrierFilterToMap(initCarrier, mapAlreadyReady);
      setTimeout(() => {
        if (apaczkaMapInstance && apaczkaMapInstance.map) {
          apaczkaMapInstance.map.invalidateSize();
        }
      }, 250);
    } catch (err) {
      console.error("Map load error:", err);
    }
  };

  // ── Live Sync with Shopify Backend (1084d2-13.myshopify.com) ──────────
  async function syncWithShopifyBackend() {
    try {
      const resp = await fetch(`https://${CFG.shopDomain}/products.json?limit=250`);
      if (!resp.ok) return;
      const data = await resp.json();
      const remoteProducts = data.products || [];
      let updated = false;

      remoteProducts.forEach((rp) => {
        if (!rp.variants || !rp.variants.length) return;
        const rv = rp.variants[0];
        const isDomivioTagged =
          (Array.isArray(rp.tags) && rp.tags.some((t) => String(t).toLowerCase().includes("domivio"))) ||
          (typeof rp.tags === "string" && rp.tags.toLowerCase().includes("domivio")) ||
          String(rp.vendor || "").toLowerCase() === "domivio";

        if (
          !isDomivioTagged &&
          !String(rp.handle || "").includes("montessori") &&
          !String(rp.handle || "").includes("krysztal")
        ) {
          return; // Keep DOMIVIO products & prices completely independent from Aeterna!
        }

        const local = PRODUCTS.find(
          (p) =>
            p.handle === rp.handle ||
            p.id === rp.id ||
            (String(p.handle || "").includes("montessori") && String(rp.handle || "").includes("montessori")) ||
            (String(p.handle || "").includes("krysztal") && String(rp.handle || "").includes("krysztal"))
        );
        if (local) {
          local.id = rp.id;
          local.variantId = rv.id;
          local.shopifyVariantId = rv.id;
          const livePrice = parseFloat(rv.price);
          if (!isNaN(livePrice) && livePrice > 0) {
            local.pricePLN = livePrice;
            local.priceEUR = Number((livePrice / 4.25).toFixed(2));
          }
          updated = true;
        }
      });

      if (updated) {
        renderHeroPrice();
        renderCatalog();
        renderCartUI();
      }
    } catch (e) {
      // Fallback to bundled catalog if offline
    }
  }

  // ── Init on DOMContentLoaded ──────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    window.setDomivioLang(currentLang);
    syncWithShopifyBackend();
  });
})();
