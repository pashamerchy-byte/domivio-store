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
  let activeDiscount = localStorage.getItem("domivio_discount_unlocked") === "1" ? CFG.discountCode : "";
  let selectedLocker = loadLocker();
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
    } else {
      localStorage.removeItem("domivio_selected_locker");
    }
    renderCartUI();
  }

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

  // ── Catalog Rendering & Filtering ─────────────────────────────────────
  window.filterCatalog = function (cat) {
    currentCategory = cat || "all";
    document.querySelectorAll("[data-filter-cat]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-filter-cat") === currentCategory);
    });
    renderCatalog();
  };

  // Track selected pack quantity and image index per product card (Solo Stove style)
  const cardPackState = {};
  const cardImgState = {};

  window.selectCardPack = function (handle, qty, ev) {
    if (ev) ev.stopPropagation();
    cardPackState[handle] = qty;
    renderCatalog();
  };

  window.selectCardImage = function (handle, idx, ev) {
    if (ev) ev.stopPropagation();
    cardImgState[handle] = idx;
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
        const packQty = cardPackState[p.handle] || 1;
        const imgIdx = cardImgState[p.handle] || 0;
        const unitPrice = getProductPrice(p);
        const unitComp = getProductCompare(p);
        const discMult = packQty === 3 ? 0.85 : packQty === 2 ? 0.9 : 1;
        const totalPrice = unitPrice * packQty * discMult;
        const totalComp = unitComp ? unitComp * packQty : 0;
        const savePct = totalComp ? Math.round(((totalComp - totalPrice) / totalComp) * 100) : 0;
        const badgeText = p.isMysteryBox
          ? currentLang === "en" ? "Best Seller" : "Bestseller"
          : currentLang === "en" ? "Best Seller" : "Bestseller";
        const activeImg = (p.images && p.images[imgIdx]) || p.images[0];
        const maxDots = Math.min((p.images || []).length, 4);

        const dotsHtml =
          maxDots > 1
            ? `<div class="p-card__dots-pill" onclick="event.stopPropagation()">
                ${Array.from({ length: maxDots })
                  .map(
                    (_, idx) =>
                      `<button type="button" class="p-card__dot ${idx === imgIdx ? "is-active" : ""}" onclick="selectCardImage('${p.handle}', ${idx}, event)" aria-label="Zdjęcie ${idx + 1}"></button>`
                  )
                  .join("")}
              </div>`
            : "";

        return `
          <article class="p-card">
            <div class="p-card__img-wrap" onclick="openProductModal('${p.handle}', ${packQty})">
              <div class="p-card__badges">
                <span class="p-card__badge">${badgeText}</span>
                ${savePct > 0 ? `<span class="p-card__save">-${savePct}%</span>` : ""}
              </div>
              <img src="${activeImg}" alt="${p.title[currentLang]}" loading="lazy">
              ${dotsHtml}
            </div>
            <div class="p-card__body">
              <h3 class="p-card__title" onclick="openProductModal('${p.handle}', ${packQty})">${p.title[currentLang]}</h3>
              <p class="p-card__desc">${p.shortDesc[currentLang]}</p>
              <div class="p-card__rating">
                <span class="p-card__stars">★★★★★</span>
                <span class="p-card__rev-count">${p.reviewsCount} ${currentLang === "en" ? "Reviews" : "Opinii"}</span>
              </div>

              <div class="p-card__variants">
                <button type="button" class="p-card__pill ${packQty === 1 ? "is-active" : ""}" onclick="selectCardPack('${p.handle}', 1, event)">
                  ${currentLang === "en" ? "1 pc · Standard" : "1 szt. · Standard"}
                </button>
                <button type="button" class="p-card__pill ${packQty === 2 ? "is-active" : ""}" onclick="selectCardPack('${p.handle}', 2, event)">
                  ${currentLang === "en" ? "2 pcs (-10%)" : "2 szt. (-10%)"}
                </button>
                <button type="button" class="p-card__pill ${packQty === 3 ? "is-active" : ""}" onclick="selectCardPack('${p.handle}', 3, event)">
                  ${currentLang === "en" ? "3 pcs (-15%)" : "3 szt. (-15%)"}
                </button>
                <span class="p-card__ship-pill">
                  🚚 ${currentLang === "en" ? "Free shipping from 99 PLN ✓" : "Darmowa dostawa od 99 zł ✓"}
                </span>
              </div>

              <div class="p-card__price-row">
                <span class="p-card__price">${formatValue(totalPrice)}</span>
                ${totalComp ? `<span class="p-card__old">${formatValue(totalComp)}</span>` : ""}
              </div>

              <div class="p-card__actions">
                <button type="button" class="p-card__atc" onclick="addToCart(${p.variantId}, ${packQty}, true)">
                  <span>${currentLang === "en" ? "Add to Cart" : "Dodaj do koszyka"}</span>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                </button>
              </div>
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

    const packsHtml = true
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
          <div style="display:inline-block;background:#E85D22;color:#FFFFFF;padding:4px 10px;border-radius:4px;font-size:11.5px;font-weight:600;margin-bottom:10px;">
            ${currentLang === "en" ? "Best Seller" : "Bestseller"}
          </div>
          <h2 style="font-size:24px;font-weight:600;letter-spacing:-0.02em;line-height:1.25;margin-bottom:8px;color:#000000;">${prod.title[currentLang]}</h2>
          <div style="font-size:13px;font-weight:600;color:#E85D22;margin-bottom:12px;">★★★★★ <span style="color:#666666;font-weight:400;">${prod.rating} (${prod.reviewsCount} ${currentLang === "en" ? "Reviews" : "Opinii"})</span></div>
          <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:14px;">
            <span style="font-size:26px;font-weight:600;color:#000000;">${formatValue(activeTotal)}</span>
            ${unitComp ? `<span style="font-size:15px;color:#888888;text-decoration:line-through;font-weight:400;">${formatValue(unitComp * activePdpPackQty)}</span>` : ""}
          </div>
          <p style="font-size:14px;color:#333333;line-height:1.55;margin-bottom:14px;">${prod.shortDesc[currentLang]}</p>
          <ul style="list-style:none;display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:500;color:#222222;margin-bottom:16px;">
            ${prod.bullets[currentLang].map((b) => `<li>${b}</li>`).join("")}
          </ul>
          ${packsHtml}
          <button type="button" class="btn-yellow" style="width:100%;margin-bottom:12px;" onclick="addToCart(${prod.variantId}, ${activePdpPackQty}, true); closeProductModal();">
            ${t("btn_add_to_cart")} — ${formatValue(activeTotal)}
          </button>
          <div style="background:#F7F7F7;border:1px solid #E5E5E5;border-radius:10px;padding:12px 14px;font-size:12.5px;display:flex;flex-direction:column;gap:5px;font-weight:500;color:#222222;">
            <div style="color:#15803D;font-weight:600;">● ${t("stock_in_stock")}</div>
            <div>🚚 ${t("trust_fast_ship")} (Darmowa dostawa od 99 zł)</div>
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
      // Bundle discount if qty === 2 (-10%) or qty >= 3 (-15%)
      if (item.qty === 2) lineTotal = lineTotal * 0.9;
      else if (item.qty >= 3) lineTotal = lineTotal * 0.85;
      subtotal += lineTotal;
      totalCount += item.qty;
    });

    const discountAmount = activeDiscount ? subtotal * 0.1 : 0;
    const totalAfterDiscount = Math.max(0, subtotal - discountAmount);
    const threshold = currentLang === "en" ? CFG.freeShippingEUR : CFG.freeShippingPLN;
    const remainingForFreeShip = Math.max(0, threshold - totalAfterDiscount);
    const progressPct = Math.min(100, (totalAfterDiscount / threshold) * 100);

    return {
      subtotal,
      discountAmount,
      totalAfterDiscount,
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
          ? `Added to cart! Only <strong>${formatValue(totals.remainingForFreeShip)}</strong> away from FREE shipping!`
          : `Dodano do koszyka! Do darmowej dostawy brakuje Ci tylko <strong>${formatValue(totals.remainingForFreeShip)}</strong>`;
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

    // Free Shipping Bar
    const shipLabel = document.getElementById("shipBarLabel");
    const shipFill = document.getElementById("shipBarFill");
    if (shipLabel && shipFill) {
      shipFill.style.width = totals.progressPct + "%";
      if (totals.remainingForFreeShip > 0) {
        shipLabel.innerHTML =
          currentLang === "en"
            ? `${t("shipping_bar_pre")}<strong>${formatValue(totals.remainingForFreeShip)}</strong> away from FREE shipping!`
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
          packBadge = `<span style="background:#E85D22;color:#FFFFFF;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;margin-left:6px;">-10% PAKIET</span>`;
        } else if (item.qty >= 3) {
          lineTotal *= 0.85;
          packBadge = `<span style="background:#E85D22;color:#FFFFFF;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;margin-left:6px;">-15% PAKIET</span>`;
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

    // Render 1-Click Mystery Box Order Bump (if not already in cart) + 1-Click Accessories Cross-Sell + InPost/DPD Map Picker
    const otherProd = PRODUCTS.find((p) => !cart.some((i) => i.variantId === p.variantId));

    const mysteryBumpHtml = otherProd
      ? `
        <div class="mystery-bump">
          <div class="mystery-bump__top">
            <span class="mystery-bump__tag">${t("mystery_upsell_tag")}</span>
            <span class="mystery-bump__save">${t("mystery_upsell_save")}</span>
          </div>
          <div class="mystery-bump__row">
            <img class="mystery-bump__img" src="${otherProd.images[0]}" alt="">
            <div>
              <div style="font-size:13px;font-weight:900;line-height:1.25;">${otherProd.title[currentLang]}</div>
              <div style="font-size:11.5px;color:#334155;">${t("mystery_upsell_desc")}</div>
            </div>
          </div>
          <button type="button" class="mystery-bump__btn" onclick="addToCart(${otherProd.variantId}, 1, false)">
            ${t("mystery_upsell_btn")} (${formatValue(getProductPrice(otherProd))})
          </button>
        </div>
      `
      : "";

    const accProducts = PRODUCTS.filter(
      (p) => p.isAccessoryUpsell && !cart.some((i) => i.variantId === p.variantId)
    );

    const accHtml =
      accProducts.length > 0
        ? `
        <div class="acc-upsell">
          <div class="acc-upsell__title">${t("acc_upsell_title")}</div>
          <div class="acc-upsell__list">
            ${accProducts
              .map(
                (acc) => `
              <div class="acc-card">
                <img src="${acc.images[0]}" alt="${acc.title[currentLang]}">
                <div>
                  <div style="font-size:12px;font-weight:800;line-height:1.2;">${acc.title[currentLang]}</div>
                  <div style="font-size:12px;font-weight:900;color:#D97706;">${formatValue(getProductPrice(acc))}</div>
                </div>
                <button type="button" class="acc-card__btn" onclick="addToCart(${acc.variantId}, 1, false)">
                  ${t("acc_add_btn")}
                </button>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
        : "";

    const lockerHtml =
      selectedLocker && selectedLocker.code
        ? `
        <div class="locker-box">
          <div class="locker-box__title">${t("locker_selected_label")}</div>
          <div class="locker-selected">
            <div>
              <span class="locker-selected__badge">${selectedLocker.supplier === "INPOST" ? "INPOST PACZKOMAT" : "DPD PICKUP"}</span>
              <div style="font-size:13px;font-weight:900;">${selectedLocker.code}</div>
              <div style="font-size:11.5px;color:#475569;">${selectedLocker.street}, ${selectedLocker.postal_code} ${selectedLocker.city}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <button type="button" class="acc-card__btn" onclick="openApaczkaLockerMap('${selectedLocker.supplier || "ALL"}')">${t("locker_change_btn")}</button>
              <button type="button" style="background:none;border:none;font-size:10.5px;font-weight:800;color:#DC2626;" onclick="clearSelectedLocker()">${t("locker_remove_btn")}</button>
            </div>
          </div>
        </div>
      `
        : `
        <div class="locker-box">
          <div class="locker-box__title">${t("locker_title")}</div>
          <div class="locker-box__btns">
            <button type="button" class="locker-btn" onclick="openApaczkaLockerMap('INPOST')">
              <span class="locker-btn__name">📦 INPOST PACZKOMAT</span>
              <span class="locker-btn__sub">${t("locker_inpost_sub")}</span>
            </button>
            <button type="button" class="locker-btn" onclick="openApaczkaLockerMap('DPD')">
              <span class="locker-btn__name">📦 DPD PICKUP</span>
              <span class="locker-btn__sub">${t("locker_dpd_sub")}</span>
            </button>
          </div>
        </div>
      `;

    upsellWrap.innerHTML = mysteryBumpHtml + lockerHtml + accHtml;

    // Summary totals
    document.getElementById("summarySubtotal").textContent = formatValue(totals.subtotal);
    const discRow = document.getElementById("summaryDiscountRow");
    const discVal = document.getElementById("summaryDiscountVal");
    if (discRow && discVal) {
      if (totals.discountAmount > 0) {
        discRow.style.display = "flex";
        discVal.textContent = "−" + formatValue(totals.discountAmount);
      } else {
        discRow.style.display = "none";
      }
    }
    document.getElementById("summaryShipping").textContent =
      totals.remainingForFreeShip === 0 ? t("cart_shipping_free") : t("cart_shipping_calc");
    document.getElementById("summaryTotal").textContent = formatValue(totals.totalAfterDiscount);
  }

  window.clearSelectedLocker = function () {
    saveLocker(null);
  };

  window.applyManualDiscount = function () {
    const inp = document.getElementById("cartDiscountInput");
    if (!inp) return;
    const val = (inp.value || "").trim().toUpperCase();
    if (val === "AETERNA10" || val === "DOMIVIO10" || val === "WELCOME10" || val === "RABAT10") {
      activeDiscount = CFG.discountCode;
      localStorage.setItem("domivio_discount_unlocked", "1");
      inp.value = CFG.discountCode;
      renderCartUI();
      updateWelcomePillUI();
    } else {
      inp.style.borderColor = "#DC2626";
      setTimeout(() => (inp.style.borderColor = "#111111"), 1200);
    }
  };

  // ── Direct Shopify Cart Permalink Checkout (Passes Variants + Discount + Paczkomat) ──
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

    if (activeDiscount) {
      params.set("discount", activeDiscount);
    }

    if (selectedLocker && selectedLocker.code) {
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

  // ── Welcome -10% Modal & Strict RODO Validation (Exact Aeterna Parity) ──
  function updateWelcomePillUI() {
    const pill = document.getElementById("welcomePill");
    const label = document.getElementById("welcomePillLabel");
    if (!pill || !label) return;
    if (localStorage.getItem("domivio_pill_dismissed") === "1") {
      pill.style.display = "none";
      return;
    }
    pill.style.display = "inline-flex";
    if (activeDiscount) {
      label.textContent = t("pill_unlocked");
    } else {
      label.textContent = t("pill_label");
    }
  }

  window.openExitModal = function () {
    const m = document.getElementById("exitModal");
    if (!m) return;
    const offerStep = document.getElementById("exitStepOffer");
    const successStep = document.getElementById("exitStepSuccess");
    if (activeDiscount) {
      offerStep.style.display = "none";
      successStep.style.display = "block";
    } else {
      offerStep.style.display = "block";
      successStep.style.display = "none";
    }
    m.classList.add("is-open");
  };

  window.closeExitModal = function () {
    const m = document.getElementById("exitModal");
    if (m) m.classList.remove("is-open");
    sessionStorage.setItem("domivio_exit_seen", "1");
  };

  window.dismissWelcomePill = function () {
    localStorage.setItem("domivio_pill_dismissed", "1");
    updateWelcomePillUI();
  };

  window.submitExitDiscountForm = function (ev) {
    ev.preventDefault();
    const emailInput = document.getElementById("exitEmailInput");
    const rodoCheckbox = document.getElementById("exitRodoCheckbox");
    const rodoLabel = document.getElementById("exitRodoLabel");

    const emailVal = (emailInput.value || "").trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailVal);
    const rodoChecked = Boolean(rodoCheckbox && rodoCheckbox.checked);

    let hasError = false;
    if (!emailValid) {
      emailInput.classList.add("is-invalid");
      emailInput.focus();
      hasError = true;
    } else {
      emailInput.classList.remove("is-invalid");
    }

    if (!rodoChecked) {
      rodoLabel.classList.remove("is-invalid");
      void rodoLabel.offsetWidth;
      rodoLabel.classList.add("is-invalid");
      hasError = true;
    } else {
      rodoLabel.classList.remove("is-invalid");
    }

    if (hasError) return false;

    // Unlock -10% discount
    activeDiscount = CFG.discountCode;
    localStorage.setItem("domivio_discount_unlocked", "1");
    localStorage.setItem("domivio_subscriber_email", emailVal);
    try {
      navigator.clipboard.writeText(CFG.discountCode);
    } catch (e) {}

    document.getElementById("exitStepOffer").style.display = "none";
    document.getElementById("exitStepSuccess").style.display = "block";
    renderCartUI();
    updateWelcomePillUI();
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

    // Desktop Exit-Intent trigger
    document.addEventListener("mouseout", (e) => {
      if (
        e.clientY <= 0 &&
        !activeDiscount &&
        sessionStorage.getItem("domivio_exit_seen") !== "1"
      ) {
        sessionStorage.setItem("domivio_exit_seen", "1");
        openExitModal();
      }
    });
  });
})();
