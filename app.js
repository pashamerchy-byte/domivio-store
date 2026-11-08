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
      if (Array.isArray(raw) && raw.length > 0) {
        return raw.filter((item) => PRODUCTS.some((p) => p.variantId === item.variantId));
      }
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

  // ── Hero Slider, Story Switcher & Catalog Rendering (1:1 Darwin Sleep) ──
  let selectedSizes = {};
  let currentHeroSlide = 1;

  window.setProductSize = function (handle, sizeVal) {
    if (handle && sizeVal) {
      selectedSizes[handle] = sizeVal;
    }
  };

  window.switchDarwinSlide = function (num) {
    currentHeroSlide = num === 2 ? 2 : 1;
    const s1 = document.getElementById("dwHeroSlide1");
    const s2 = document.getElementById("dwHeroSlide2");
    if (!s1 || !s2) return;
    if (currentHeroSlide === 2) {
      s1.style.display = "none";
      s2.style.display = "flex";
    } else {
      s1.style.display = "flex";
      s2.style.display = "none";
    }
  };

  const STORIES_DATA = [
    {
      pl: {
        text: "Najważniejszy w sypialni jest materac i poduszka, bo przesypiamy jedną trzecią życia. Siatka elastomerowa Domivio Cell pozwala mięśniom karku całkowicie się rozluźnić już w pierwsze 10 minut i utrzymuje przyjemny chłód przez całą noc.",
        author: "Kamil Karapetyan",
        role: "Projektant wnętrz & specjalista ergonomii snu"
      },
      en: {
        text: "The most important thing in any bedroom is your pillow and mattress because we spend a third of our lives sleeping. The Domivio Cell grid lets your neck muscles completely relax within minutes.",
        author: "Kamil Karapetyan",
        role: "Interior Designer & Sleep Ergonomics Specialist"
      }
    },
    {
      pl: {
        text: "Jako fizjoterapeutka polecam poduszkę Wave M® pacjentom z napięciem odcinka szyjnego. Dwa profile wysokości (8,5 i 10 cm) oraz sprężysta kratownica TPE stabilizują kręgosłup zarówno na boku, jak i na plecach.",
        author: "dr Marta Lewandowska",
        role: "Fizjoterapeutka & ekspertka rehabilitacji kręgosłupa"
      },
      en: {
        text: "As a physiotherapist, I recommend the Wave M® pillow for cervical tension. Dual contour heights (8.5 and 10 cm) and the elastic TPE grid align the spine on both side and back.",
        author: "Dr. Marta Lewandowska",
        role: "Physiotherapist & Spine Rehabilitation Specialist"
      }
    },
    {
      pl: {
        text: "Dla naszego synka wybraliśmy model Flat® / Teenager® o niskim profilu 6,5 cm. Zero przegrzewania główki, poszewka Tencel™ jest cudownie chłodna w dotyku, a poduszka można umyć pod bieżącą wodą.",
        author: "Karolina i Piotr W.",
        role: "Rodzice 7-letniego Leona · Warszawa"
      },
      en: {
        text: "For our son we chose the Flat® / Teenager® low-profile 6.5 cm pillow. Zero overheating, the Tencel™ cover feels cool to the touch, and the grid is washable.",
        author: "Karolina & Piotr W.",
        role: "Parents · Warsaw"
      }
    },
    {
      pl: {
        text: "Po wymianie zwykłego materaca piankowego na hybrydowy Cell Premium 160×200 przestaliśmy budzić się z bólem lędźwi. Nie przenosi drgań, gdy druga osoba wstaje w nocy — wart każdej złotówki.",
        author: "Tomasz Krawczyk",
        role: "Architekt · Kraków"
      },
      en: {
        text: "After switching from regular memory foam to the Cell Premium 160×200 hybrid mattress, our lower-back pain disappeared. Zero motion transfer when my partner moves at night.",
        author: "Tomasz Krawczyk",
        role: "Architect · Krakow"
      }
    },
    {
      pl: {
        text: "Kupiliśmy zestaw dla par (2× Adult® z rabatem -10% i darmowym Paczkomatem InPost). Brak zagnieceń na twarzy rano to prawda — skóra odpoczywa bez ucisku przez całą noc!",
        author: "Aleksandra Nowak",
        role: "Kosmetolog · Gdańsk"
      },
      en: {
        text: "We ordered the couples bundle (2× Adult® with 10% off and free InPost Locker delivery). Waking up without sleep creases on my face is real — zero skin compression all night!",
        author: "Aleksandra Nowak",
        role: "Cosmetologist · Gdansk"
      }
    }
  ];

  window.switchDarwinStory = function (idx) {
    const i = Math.max(0, Math.min(STORIES_DATA.length - 1, Number(idx) || 0));
    const st = STORIES_DATA[i][currentLang] || STORIES_DATA[i].pl;
    const txtEl = document.querySelector(".dw-reviews__story-text");
    const authEl = document.querySelector(".dw-reviews__story-author");
    const roleEl = document.querySelector(".dw-reviews__story-role");
    if (txtEl) txtEl.textContent = st.text;
    if (authEl) authEl.textContent = st.author;
    if (roleEl) roleEl.textContent = st.role;
    document.querySelectorAll(".dw-avatar").forEach((el, k) => el.classList.toggle("is-active", k === i));
    document.querySelectorAll(".dw-reviews__nums span").forEach((el, k) => el.classList.toggle("is-active", k === i));
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

    if (list.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; background: #F5F5F7; padding: 64px 24px; text-align: center;">
          <div style="font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #7B42F6; margin-bottom: 10px;">DOMIVIO CATALOG</div>
          <div style="font-size: 20px; font-weight: 500; color: #242C34; text-transform: uppercase;">${
            currentLang === "en" ? "New collection is being prepared" : "Nowy katalog produktów w przygotowaniu"
          }</div>
        </div>
      `;
      return;
    }

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
        const currentSz = selectedSizes[p.handle] || (p.sizes && p.sizes[0]) || "";
        if (currentSz && !selectedSizes[p.handle]) selectedSizes[p.handle] = currentSz;

        const sizesHtml =
          p.sizes && p.sizes.length > 0
            ? `
              <div class="dw-card__size-row">
                <span>${t("size_label")}</span>
                <select class="dw-card__size-select" aria-label="Rozmiar" onchange="setProductSize('${p.handle}', this.value)">
                  ${p.sizes.map((sz) => `<option value="${sz}" ${sz === currentSz ? "selected" : ""}>${sz}</option>`).join("")}
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
              <img class="dw-card__img" src="${p.images[0]}" alt="${p.title[currentLang]}" width="320" height="320" loading="lazy" decoding="async" />
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
              <button type="button" class="dw-card__mobile-atc" onclick="addToCart(${p.variantId}, 1, true)">
                ${t("btn_add_to_cart")}
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  // ── 1:1 Darwin Full-Page Product View (#pdpPageView — darwinsleep.ru/shop/poduska/adult) ──
  let pdpCoverSelected = false;
  let activePdpFeatureIdx = 0;
  let activePdpAccordionTab = null;

  function resolveAsset(filename) {
    return (window.DOMIVIO_ASSET_MAP && window.DOMIVIO_ASSET_MAP[filename]) || filename;
  }

  const PDP_VIOLET_FEATURES = [
    {
      img: "darwin_feat_wash.jpg",
      pl: {
        title: "MOŻNA MYĆ",
        desc: "TPE (ТПЭ) nie wymaga specjalnej pielęgnacji — wystarczy umyć poduszkę pod bieżącą wodą. Materiał jest odporny na pleśń i roztocza oraz zachowuje swoją nowość po 10.000 cykli czyszczenia."
      },
      en: {
        title: "FULLY WASHABLE",
        desc: "Hyper-elastic TPE requires effortless care — simply rinse the pillow under running water. Naturally resistant to mold and dust mites, keeping its freshness after 10,000 wash cycles."
      }
    },
    {
      img: "darwin_feat_air.jpg",
      pl: {
        title: "PRZEPUSZCZA POWIETRZE",
        desc: "Setki otwartych komórek wentylacyjnych tworzą swobodną cyrkulację powietrza 360°. Poduszka odprowadza nadmiar ciepła i wilgoci, zapewniając przyjemny chłód przez całą noc."
      },
      en: {
        title: "360° BREATHABLE AIRFLOW",
        desc: "Hundreds of open honeycomb air channels create continuous 360° ventilation, dissipating heat and moisture so your head stays cool all night."
      }
    },
    {
      img: "darwin_feat_forever.jpg",
      pl: {
        title: "ZDROWY SEN NA ZAWSZE",
        desc: "Opatentowana kratownica elastomerowa CELL® błyskawicznie wraca do pierwotnego kształtu i nie zapada się nawet po latach codziennego użytkowania."
      },
      en: {
        title: "HEALTHY SLEEP FOREVER",
        desc: "The patented CELL® elastomer grid rebounds instantaneously and retains its orthopedic geometry for years without sagging or flattening."
      }
    }
  ];

  window.switchPdpFeatureTab = function (idx) {
    activePdpFeatureIdx = Number(idx) || 0;
    if (activePdpProduct) {
      openProductModal(activePdpProduct.handle, activePdpPackQty, true);
    }
  };

  window.togglePdpCoverAddon = function () {
    pdpCoverSelected = !pdpCoverSelected;
    if (activePdpProduct) {
      openProductModal(activePdpProduct.handle, activePdpPackQty, true);
    }
  };

  window.togglePdpAccordion = function (tabKey) {
    activePdpAccordionTab = activePdpAccordionTab === tabKey ? null : tabKey;
    if (activePdpProduct) {
      openProductModal(activePdpProduct.handle, activePdpPackQty, true);
    }
  };

  window.addPdpSelectionToCart = function (variantId, packQty) {
    addToCart(variantId, packQty || 1, true);
    if (pdpCoverSelected) {
      const coverProd = PRODUCTS.find((p) => p.handle === "poszewka-chlodzaca-tencel-cell");
      if (coverProd && coverProd.variantId !== Number(variantId)) {
        addToCart(coverProd.variantId, 1, true);
      }
      pdpCoverSelected = false;
    }
  };

  window.openProductModal = function (handle, packQty, preserveScroll) {
    const prod = PRODUCTS.find((p) => p.handle === handle);
    if (!prod) return;
    const isNewProduct = !activePdpProduct || activePdpProduct.handle !== prod.handle;
    activePdpProduct = prod;
    activePdpPackQty = packQty || 1;
    if (isNewProduct && !preserveScroll) {
      pdpCoverSelected = false;
      activePdpFeatureIdx = 0;
      activePdpAccordionTab = null;
    }

    const homeView = document.getElementById("homeMainView");
    const pdpView = document.getElementById("pdpPageView");
    const modal = document.getElementById("pdpModal");
    if (modal) modal.classList.remove("is-open");

    if (!pdpView) return;

    const unitPrice = getProductPrice(prod);
    const unitComp = getProductCompare(prod);

    const p1 = unitPrice;
    const p2Orig = unitPrice * 2;
    const p2Disc = p2Orig * 0.9;
    const p3Orig = unitPrice * 3;
    const p3Disc = p3Orig * 0.85;

    const activeTotal =
      activePdpPackQty === 3 ? p3Disc : activePdpPackQty === 2 ? p2Disc : p1;
    const origCompareTotal = unitComp
      ? unitComp * activePdpPackQty
      : activePdpPackQty > 1
      ? unitPrice * activePdpPackQty
      : 0;
    const savePct = origCompareTotal
      ? Math.round(((origCompareTotal - activeTotal) / origCompareTotal) * 100)
      : 0;

    const coverProd = PRODUCTS.find((p) => p.handle === "poszewka-chlodzaca-tencel-cell");
    const coverAddonPrice = coverProd ? getProductPrice(coverProd) : (currentLang === "en" ? 23 : 99);
    const displayGrandTotal = activeTotal + (pdpCoverSelected ? coverAddonPrice : 0);

    const bonusPts = Math.max(10, Math.round(displayGrandTotal * 0.1));
    const split6Val = Math.ceil(displayGrandTotal / 6);
    const split4Val = Math.ceil(displayGrandTotal / 4);
    const split6Str = currentLang === "en" ? "€" + split6Val : split6Val + " zł";
    const split4Str = currentLang === "en" ? "€" + split4Val : split4Val + " zł";

    const currentSz = selectedSizes[prod.handle] || (prod.sizes && prod.sizes[0]) || "";
    const catBreadcrumb =
      currentLang === "en"
        ? prod.catLabelEN || "Pillows"
        : prod.catLabelPL === "MATERACE"
        ? "Materace"
        : prod.catLabelPL === "AKCESORIA"
        ? "Akcesoria"
        : "Poduszki";

    const specHeight =
      currentLang === "en"
        ? prod.specHeightEN || "Height — 10/12 cm"
        : prod.specHeightPL || "Wysokość — 10/12 cm";
    const specFirm =
      currentLang === "en"
        ? prod.specFirmEN || "Firmness — medium"
        : prod.specFirmPL || "Twardość — średnia";

    const galleryHtml = (prod.images || [])
      .map((imgSrc, idx) => {
        const resolved = resolveAsset(imgSrc);
        if (idx === 0) {
          const badgesHtml = (prod.badges || [])
            .map((b) => `<span class="dw-badge dw-badge--${b.type}">${b.text}</span>`)
            .join("");
          return `
            <div class="dw-pdp__img-box dw-pdp__img-box--hero">
              <div class="dw-pdp__img-badges">${badgesHtml}</div>
              <div class="dw-pdp__img-actions">
                <button type="button" class="dw-pdp__action-icon" aria-label="Porównaj">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 20V10M12 20V4M18 20v-8"/></svg>
                </button>
                <button type="button" class="dw-pdp__action-icon" aria-label="Ulubione">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-4.5-9-8.5C1.5 9 3.5 5 7.5 5c2.2 0 3.5 1.2 4.5 2.5C13 6.2 14.3 5 16.5 5 20.5 5 22.5 9 21 12.5c-2 4-9 8.5-9 8.5z"/></svg>
                </button>
              </div>
              <div class="dw-pdp__collab-head">
                <div class="dw-pdp__collab-brand">domivio <span>x</span> CELL®</div>
                <div class="dw-pdp__collab-sub">${
                  currentLang === "en"
                    ? "Mornings without a trace of yesterday"
                    : "Poranek bez śladów wczorajszego dnia"
                }</div>
              </div>
              <img src="${resolved}" alt="${prod.title[currentLang]}" class="dw-pdp__img" />
            </div>
          `;
        }
        return `
          <div class="dw-pdp__img-box">
            <img src="${resolved}" alt="${prod.title[currentLang]} - ${idx + 1}" class="dw-pdp__img" loading="lazy" />
          </div>
        `;
      })
      .join("");

    const sizeAndPackHtml = `
      <div class="dw-pdp__options">
        ${
          prod.sizes && prod.sizes.length > 0
            ? `
          <div class="dw-pdp__opt-row">
            <span class="dw-pdp__opt-label">${t("size_label")}</span>
            <select class="dw-pdp__opt-select" onchange="setProductSize('${prod.handle}', this.value); renderCatalog();">
              ${prod.sizes.map((sz) => `<option value="${sz}" ${sz === currentSz ? "selected" : ""}>${sz}</option>`).join("")}
            </select>
          </div>
        `
            : ""
        }
        <div class="dw-pdp__pack-pills">
          <button type="button" class="dw-pdp__pack-pill ${activePdpPackQty === 1 ? "is-active" : ""}" onclick="openProductModal('${prod.handle}', 1, true)">
            1 ${currentLang === "en" ? "pc." : "szt."} — ${formatValue(p1)}
          </button>
          <button type="button" class="dw-pdp__pack-pill ${activePdpPackQty === 2 ? "is-active" : ""}" onclick="openProductModal('${prod.handle}', 2, true)">
            2 ${currentLang === "en" ? "pcs" : "szt."} <span>-10%</span>
          </button>
          <button type="button" class="dw-pdp__pack-pill ${activePdpPackQty === 3 ? "is-active" : ""}" onclick="openProductModal('${prod.handle}', 3, true)">
            3 ${currentLang === "en" ? "pcs" : "szt."} <span>-15%</span>
          </button>
        </div>
      </div>
    `;

    const addonHtml =
      prod.handle !== "poszewka-chlodzaca-tencel-cell"
        ? `
      <div class="dw-pdp__addon ${pdpCoverSelected ? "is-selected" : ""}" onclick="togglePdpCoverAddon()">
        <span class="dw-pdp__addon-icon">${pdpCoverSelected ? "✓" : "⊕"}</span>
        <span class="dw-pdp__addon-verb">${currentLang === "en" ? "ADD:" : "DODAĆ:"}</span>
        <img src="${resolveAsset("darwin_pillowcase.png")}" alt="" class="dw-pdp__addon-thumb" />
        <span class="dw-pdp__addon-title">${
          currentLang === "en"
            ? `COOLING COVER FOR ${prod.title.en.split(" ")[0]} (+${formatValue(coverAddonPrice)})`
            : `CHŁODZĄCA POSZEWKA DO ${prod.title.pl.split(" ")[0]} (+${formatValue(coverAddonPrice)})`
        }</span>
      </div>
    `
        : "";

    let tabDrawerHtml = "";
    if (activePdpAccordionTab === "opis") {
      tabDrawerHtml = `
        <div class="dw-pdp__tab-drawer">
          <p>${prod.shortDesc[currentLang]}</p>
          <ul>${(prod.bullets[currentLang] || []).map((b) => `<li>${b}</li>`).join("")}</ul>
        </div>
      `;
    } else if (activePdpAccordionTab === "charakterystyka") {
      tabDrawerHtml = `
        <div class="dw-pdp__tab-drawer">
          <div class="dw-pdp__spec-line"><span>Materiał rdzenia:</span><strong>100% hipoalergiczny elastomer TPE CELL®</strong></div>
          <div class="dw-pdp__spec-line"><span>Poszewka zewnętrzna:</span><strong>Włókno chłodzące Tencel™ (zdejmowana, do prania)</strong></div>
          <div class="dw-pdp__spec-line"><span>Wymiary / profil:</span><strong>${currentSz || specHeight}</strong></div>
          <div class="dw-pdp__spec-line"><span>Twardość:</span><strong>${specFirm}</strong></div>
          <div class="dw-pdp__spec-line"><span>Żywotność:</span><strong>10.000 cykli mycia / do 10 lat bez odkształceń</strong></div>
        </div>
      `;
    } else if (activePdpAccordionTab === "detale") {
      tabDrawerHtml = `
        <div class="dw-pdp__tab-drawer">
          <p>${
            currentLang === "en"
              ? "Every pillow includes a breathable cooling Tencel™ cover and a 14-day home trial. Can be washed directly under warm running water."
              : "W zestawie z każdą poduszką otrzymujesz oddychającą poszewkę chłodzącą Tencel™ oraz 14 dni na test w domu. Poduszkę można myć pod bieżącą wodą."
          }</p>
        </div>
      `;
    }

    const activeFeat = PDP_VIOLET_FEATURES[activePdpFeatureIdx] || PDP_VIOLET_FEATURES[0];
    const featImgUrl = resolveAsset(activeFeat.img);

    const violetFeaturesHtml = PDP_VIOLET_FEATURES.map((item, idx) => {
      const loc = item[currentLang] || item.pl;
      const isAct = idx === activePdpFeatureIdx;
      if (isAct) {
        return `
          <div class="dw-pdp__vf-item is-active" onclick="switchPdpFeatureTab(${idx})">
            <h3 class="dw-pdp__vf-title">→ ${loc.title}</h3>
            <p class="dw-pdp__vf-desc">${loc.desc}</p>
          </div>
        `;
      }
      return `
        <div class="dw-pdp__vf-item" onclick="switchPdpFeatureTab(${idx})">
          <h3 class="dw-pdp__vf-title">${loc.title}</h3>
        </div>
      `;
    }).join("");

    pdpView.innerHTML = `
      <div class="dw-container">
        <!-- Breadcrumbs (1:1 Darwin) -->
        <nav class="dw-pdp__breadcrumbs" aria-label="Breadcrumb">
          <a href="#" onclick="event.preventDefault(); closeProductModal();">${currentLang === "en" ? "Home" : "Główna"}</a>
          <span>/</span>
          <a href="#catalog" onclick="closeProductModal();">${currentLang === "en" ? "Catalog" : "Katalog"}</a>
          <span>/</span>
          <a href="#catalog" onclick="closeProductModal();">${catBreadcrumb}</a>
          <span>/</span>
          <span class="is-current">${prod.title[currentLang]}</span>
        </nav>

        <!-- Main 2-Column Product Layout (Left Vertical Stack + Right Sticky Info) -->
        <div class="dw-pdp__main">
          <div class="dw-pdp__gallery">
            ${galleryHtml}
          </div>

          <div class="dw-pdp__info">
            <div class="dw-pdp__title-row">
              <h1 class="dw-pdp__title">
                ${prod.title[currentLang]}
                <span class="dw-pdp__sale-word">${currentLang === "en" ? "SALE" : "RABAT"}</span>
              </h1>
              <a href="#why-us" class="dw-pdp__reviews-link" onclick="closeProductModal()">
                <span class="dw-pdp__star">★ ${prod.rating}</span> / <span class="dw-pdp__rev-u">${currentLang === "en" ? "REVIEWS" : "OPINIE"} (${prod.reviewsCount})</span>
              </a>
            </div>

            <div class="dw-pdp__price-row">
              <span class="dw-pdp__price">${formatValue(displayGrandTotal)}</span>
              ${origCompareTotal ? `<span class="dw-pdp__old">${formatValue(origCompareTotal)}</span>` : ""}
              ${savePct > 0 ? `<span class="dw-pdp__disc">-${savePct}%</span>` : ""}
            </div>

            <div class="dw-pdp__bonus-row">
              <span class="dw-pdp__bonus-badge">d</span>
              <span>${currentLang === "en" ? `up to +${bonusPts} bonus points` : `do +${bonusPts} pkt bonusowych`}</span>
            </div>

            <div class="dw-pdp__pills-row">
              <span class="dw-pdp__spec-pill">↕ ${specHeight}</span>
              <span class="dw-pdp__spec-pill">≈ ${specFirm}</span>
            </div>

            <div class="dw-pdp__pvz-row">
              <button type="button" class="dw-pdp__pvz-pill" onclick="openApaczkaLockerMap('ALL')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                <span>${currentLang === "en" ? "Available for Parcel Locker" : "Można do Paczkomatu"}</span>
              </button>
            </div>

            <div class="dw-pdp__gift-box">
              ${
                currentLang === "en"
                  ? "Partner gift included with your pillow order until November 15."
                  : "Prezent od partnera przy zamówieniu poduszki do 15 listopada."
              }
              <strong onclick="togglePdpAccordion('detale')">${currentLang === "en" ? "Details" : "Szczegóły"}</strong>
            </div>

            <p class="dw-pdp__desc">${prod.shortDesc[currentLang]}</p>

            ${sizeAndPackHtml}
            ${addonHtml}

            <button type="button" class="dw-pdp__atc-btn" onclick="addPdpSelectionToCart(${prod.variantId}, ${activePdpPackQty})">
              ${t("btn_add_to_cart")}
            </button>

            <div class="dw-pdp__splits">
              <div class="dw-pdp__split-box">
                <div class="dw-pdp__split-left">
                  <span class="dw-pdp__split-logo dw-pdp__split-logo--raty">0%</span>
                  <span>${currentLang === "en" ? "Installments" : "Raty 0%"}</span>
                </div>
                <span class="dw-pdp__split-val">${currentLang === "en" ? "from " : "od "}${split6Str}</span>
              </div>
              <div class="dw-pdp__split-box">
                <div class="dw-pdp__split-left">
                  <span class="dw-pdp__split-logo dw-pdp__split-logo--split">S</span>
                  <span>BLIK Split</span>
                </div>
                <span class="dw-pdp__split-val">${currentLang === "en" ? "from " : "od "}${split4Str}</span>
              </div>
            </div>

            <div class="dw-pdp__consult-row">
              <a href="mailto:domivio.official@gmail.com" class="dw-pdp__consult-link">
                <span class="dw-pdp__consult-dot">●</span>
                <span>${currentLang === "en" ? "GET A CONSULTATION" : "UZYSKAJ KONSULTACJĘ"}</span>
              </a>
            </div>

            <div class="dw-pdp__tabs-bar">
              <button type="button" class="dw-pdp__tab-btn ${activePdpAccordionTab === "opis" ? "is-open" : ""}" onclick="togglePdpAccordion('opis')">
                ${currentLang === "en" ? "DESCRIPTION" : "OPIS"} ${activePdpAccordionTab === "opis" ? "−" : "+"}
              </button>
              <button type="button" class="dw-pdp__tab-btn ${activePdpAccordionTab === "charakterystyka" ? "is-open" : ""}" onclick="togglePdpAccordion('charakterystyka')">
                ${currentLang === "en" ? "SPECIFICATIONS" : "CHARAKTERYSTYKA"} ${activePdpAccordionTab === "charakterystyka" ? "−" : "+"}
              </button>
              <button type="button" class="dw-pdp__tab-btn ${activePdpAccordionTab === "detale" ? "is-open" : ""}" onclick="togglePdpAccordion('detale')">
                ${currentLang === "en" ? "DETAILS" : "DETALE"} ${activePdpAccordionTab === "detale" ? "−" : "+"}
              </button>
            </div>
            ${tabDrawerHtml}

            <div class="dw-pdp__delivery">
              <div class="dw-pdp__del-head">
                <span>${currentLang === "en" ? "DELIVERY IN POLAND" : "DOSTAWA W POLSCE"}</span>
                <button type="button" onclick="openApaczkaLockerMap('ALL')">${currentLang === "en" ? "CHANGE" : "ZMIEŃ"}</button>
              </div>
              <div class="dw-pdp__del-row">
                <div class="dw-pdp__del-title">${currentLang === "en" ? "PARCEL LOCKER (INPOST / DPD)" : "DOSTAWA DO PACZKOMATU"}</div>
                <div class="dw-pdp__del-meta">
                  <strong>0,00 zł (od 99 zł) — 14,90 zł</strong>
                  <span>${currentLang === "en" ? "from 1 to 2 days" : "od 1 do 2 dni"}</span>
                </div>
              </div>
              <div class="dw-pdp__del-row">
                <div class="dw-pdp__del-title">${currentLang === "en" ? "COURIER DELIVERY DPD" : "DOSTAWA KURIEREM"}</div>
                <div class="dw-pdp__del-meta">
                  <strong>19,90 zł</strong>
                  <span>${currentLang === "en" ? "from 1 to 2 days" : "od 1 do 2 dni"}</span>
                </div>
              </div>
              <div class="dw-pdp__del-row">
                <div class="dw-pdp__del-title">${currentLang === "en" ? "WAREHOUSE PICKUP / 14-DAY RETURN" : "ODBIÓR / ZWROT 14 DNI"}</div>
                <div class="dw-pdp__del-meta">
                  <strong class="dw-pdp__del-free">${currentLang === "en" ? "FREE" : "BEZPŁATNIE"}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Full-Width Electric Violet Feature Showcase Section (1:1 Darwin Screenshot 1) -->
      <section class="dw-pdp__violet-sec">
        <div class="dw-container dw-pdp__violet-grid">
          <div class="dw-pdp__vf-left">
            <div class="dw-pdp__vf-brand">DOMIVIO</div>
            <div class="dw-pdp__vf-list">
              ${violetFeaturesHtml}
            </div>
          </div>
          <div class="dw-pdp__vf-right">
            <img src="${featImgUrl}" alt="${activeFeat[currentLang] ? activeFeat[currentLang].title : activeFeat.pl.title}" class="dw-pdp__vf-img" />
          </div>
        </div>
      </section>
    `;

    if (homeView) homeView.style.display = "none";
    pdpView.style.display = "block";
    if (!preserveScroll) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
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
    const pdpView = document.getElementById("pdpPageView");
    const homeView = document.getElementById("homeMainView");
    if (pdpView) pdpView.style.display = "none";
    if (homeView) homeView.style.display = "block";
    activePdpProduct = null;
  };

  // ── Cart Operations ───────────────────────────────────────────────────
  window.addToCart = function (variantId, qty, openDrawer) {
    const prod = PRODUCTS.find((p) => p.variantId === Number(variantId));
    if (!prod) return;
    const addQty = Math.max(1, parseInt(qty, 10) || 1);
    const chosenSize = selectedSizes[prod.handle] || (prod.sizes && prod.sizes[0]) || "";

    const existing = cart.find((item) => item.variantId === prod.variantId);
    if (existing) {
      existing.qty += addQty;
      if (chosenSize) existing.size = chosenSize;
    } else {
      cart.push({
        variantId: prod.variantId,
        handle: prod.handle,
        qty: addQty,
        size: chosenSize
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
        <div style="text-align:center;padding:48px 16px;">
          <div style="font-size:38px;margin-bottom:12px;">🛏️</div>
          <p style="font-weight:600;color:#242C34;margin-bottom:20px;">${t("cart_empty")}</p>
          <button type="button" class="btn-yellow" onclick="closeCartDrawer(); document.getElementById('catalog').scrollIntoView({behavior:'smooth'});">
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
          packBadge = `<span style="background:#7B42F6;color:#FFF;padding:2px 6px;font-size:10px;font-weight:600;margin-left:6px;">-10% PAKIET</span>`;
        } else if (item.qty >= 3) {
          lineTotal *= 0.85;
          packBadge = `<span style="background:#7B42F6;color:#FFF;padding:2px 6px;font-size:10px;font-weight:600;margin-left:6px;">-15% PAKIET</span>`;
        }
        const itemSz = item.size || selectedSizes[prod.handle] || (prod.sizes && prod.sizes[0]) || "";

        return `
          <div class="cart-item">
            <img class="cart-item__img" src="${prod.images[0]}" alt="${prod.title[currentLang]}" loading="lazy" decoding="async">
            <div>
              <div class="cart-item__title">${prod.title[currentLang]}</div>
              ${itemSz ? `<div style="font-size:11.5px;color:#64748B;margin-bottom:3px;">${t("size_label")} <strong>${itemSz}</strong></div>` : ""}
              <div class="cart-item__price">${formatValue(lineTotal)} ${packBadge}</div>
              <div class="cart-item__qty-ctrl">
                <button type="button" class="cart-item__qty-btn" onclick="updateCartQty(${prod.variantId}, -1)">−</button>
                <span class="cart-item__qty-val">${item.qty}</span>
                <button type="button" class="cart-item__qty-btn" onclick="updateCartQty(${prod.variantId}, 1)">+</button>
              </div>
            </div>
            <button type="button" style="background:transparent;border:none;font-size:16px;font-weight:700;color:#94A3B8;" onclick="updateCartQty(${prod.variantId}, -999)">✕</button>
          </div>
        `;
      })
      .join("");

    // Render 1-Click Second Product Order Bump + 3-Option Shipping Selector + Interactive Locker Map
    const otherProd =
      PRODUCTS.find((p) => p.handle === "poszewka-chlodzaca-tencel-cell" && !cart.some((i) => i.variantId === p.variantId)) ||
      PRODUCTS.find((p) => !cart.some((i) => i.variantId === p.variantId));

    const mysteryBumpHtml = otherProd
      ? `
        <div class="mystery-bump">
          <div class="mystery-bump__top">
            <span class="mystery-bump__tag">${t("mystery_upsell_tag")}</span>
            <span class="mystery-bump__save">${t("mystery_upsell_save")}</span>
          </div>
          <div class="mystery-bump__row">
            <img class="mystery-bump__img" src="${otherProd.images[0]}" alt="" loading="lazy" decoding="async">
            <div>
              <div style="font-size:13px;font-weight:700;color:#242C34;line-height:1.25;">${otherProd.title[currentLang]}</div>
              <div style="font-size:11.5px;color:#64748B;margin-top:2px;">${t("mystery_upsell_desc")}</div>
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
      ? `<span style="color:#16A34A;font-weight:700;">0,00 zł (GRATIS)</span> <span style="text-decoration:line-through;color:#94A3B8;font-size:11px;">${lockerPriceBase}</span>`
      : `<span style="font-weight:700;">${lockerPriceBase}</span>`;

    const selectedPointHtml =
      selectedLocker && selectedLocker.code && selectedShippingMethod !== "kurier_dpd"
        ? `
          <div class="locker-selected" style="margin-top:8px;">
            <div>
              <span class="locker-selected__badge">${selectedLocker.supplier === "INPOST" ? "INPOST PACZKOMATY" : "DPD PACZKOMATY"}</span>
              <div style="font-size:13px;font-weight:700;color:#242C34;">${selectedLocker.code}</div>
              <div style="font-size:11.5px;color:#475569;">${selectedLocker.street}, ${selectedLocker.postal_code} ${selectedLocker.city}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <button type="button" class="acc-card__btn" onclick="openApaczkaLockerMap('${selectedLocker.supplier || "ALL"}')">${t("locker_change_btn")}</button>
              <button type="button" style="background:none;border:none;font-size:10.5px;font-weight:700;color:#DC2626;" onclick="clearSelectedLocker()">${t("locker_remove_btn")}</button>
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
            style="border:1.5px solid ${selectedShippingMethod === "inpost_paczkomat" ? "#7B42F6" : "#E2E8F0"};background:${selectedShippingMethod === "inpost_paczkomat" ? "#F6F3FF" : "#FFFFFF"};padding:10px 12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;"
          >
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="radio" name="dom_ship_method" ${selectedShippingMethod === "inpost_paczkomat" ? "checked" : ""} style="accent-color:#7B42F6;width:16px;height:16px;" />
              <div>
                <div style="font-size:13px;font-weight:700;color:#242C34;">📦 InPost Paczkomaty</div>
                <button type="button" onclick="event.stopPropagation(); selectShippingMethod('inpost_paczkomat'); openApaczkaLockerMap('INPOST');" style="background:none;border:none;padding:0;font-size:11px;font-weight:600;color:#7B42F6;text-decoration:underline;">
                  ${t("locker_inpost_sub")}
                </button>
              </div>
            </div>
            <div style="text-align:right;font-size:12.5px;white-space:nowrap;">${lockerPriceDisplay}</div>
          </div>

          <div
            onclick="selectShippingMethod('dpd_paczkomat')"
            style="border:1.5px solid ${selectedShippingMethod === "dpd_paczkomat" ? "#7B42F6" : "#E2E8F0"};background:${selectedShippingMethod === "dpd_paczkomat" ? "#F6F3FF" : "#FFFFFF"};padding:10px 12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;"
          >
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="radio" name="dom_ship_method" ${selectedShippingMethod === "dpd_paczkomat" ? "checked" : ""} style="accent-color:#7B42F6;width:16px;height:16px;" />
              <div>
                <div style="font-size:13px;font-weight:700;color:#242C34;">📦 DPD Paczkomaty</div>
                <button type="button" onclick="event.stopPropagation(); selectShippingMethod('dpd_paczkomat'); openApaczkaLockerMap('DPD');" style="background:none;border:none;padding:0;font-size:11px;font-weight:600;color:#7B42F6;text-decoration:underline;">
                  ${t("locker_dpd_sub")}
                </button>
              </div>
            </div>
            <div style="text-align:right;font-size:12.5px;white-space:nowrap;">${lockerPriceDisplay}</div>
          </div>

          <div
            onclick="selectShippingMethod('kurier_dpd')"
            style="border:1.5px solid ${selectedShippingMethod === "kurier_dpd" ? "#7B42F6" : "#E2E8F0"};background:${selectedShippingMethod === "kurier_dpd" ? "#F6F3FF" : "#FFFFFF"};padding:10px 12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;"
          >
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="radio" name="dom_ship_method" ${selectedShippingMethod === "kurier_dpd" ? "checked" : ""} style="accent-color:#7B42F6;width:16px;height:16px;" />
              <div>
                <div style="font-size:13px;font-weight:700;color:#242C34;">🚚 Kurier DPD</div>
                <div style="font-size:11px;color:#64748B;">${t("locker_courier_sub")}</div>
              </div>
            </div>
            <div style="text-align:right;font-size:13px;font-weight:700;white-space:nowrap;">${courierPriceStr}</div>
          </div>
        </div>
        ${selectedPointHtml}
      </div>
    `;

    upsellWrap.innerHTML = mysteryBumpHtml + lockerHtml;

    // Summary totals (safe support for both ID naming conventions)
    const subEl = document.getElementById("cartSubtotalVal") || document.getElementById("summarySubtotal");
    if (subEl) subEl.textContent = formatValue(totals.subtotal);

    const discRow = document.getElementById("summaryDiscountRow");
    if (discRow) discRow.style.display = "none";

    const shipEl = document.getElementById("cartShippingVal") || document.getElementById("summaryShipping");
    if (shipEl) {
      if (totals.shippingCost === 0 && totals.isFreeLocker) {
        shipEl.innerHTML = `<span style="color:#16A34A;font-weight:700;">${totals.shippingMethodLabel}: 0,00 zł (GRATIS)</span>`;
      } else {
        shipEl.textContent = `${totals.shippingMethodLabel}: ${formatValue(totals.shippingCost)}`;
      }
    }

    const totEl = document.getElementById("cartTotalVal") || document.getElementById("summaryTotal");
    if (totEl) totEl.textContent = formatValue(totals.grandTotal);
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

    const sizeSummary = cart
      .map((i) => {
        const prod = PRODUCTS.find((p) => p.variantId === i.variantId);
        const sz = i.size || (prod && selectedSizes[prod.handle]) || (prod && prod.sizes && prod.sizes[0]) || "";
        return prod ? `${prod.title.pl} [${sz || "Standard"}] ×${i.qty}` : "";
      })
      .filter(Boolean)
      .join(" | ");
    if (sizeSummary) {
      params.set("attributes[Wybrane modele i rozmiary]", sizeSummary);
    }

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

    // Interactive OPINIE story avatars & numbers
    document.querySelectorAll(".dw-avatar").forEach((el, idx) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", () => window.switchDarwinStory(idx));
    });
    document.querySelectorAll(".dw-reviews__nums span").forEach((el, idx) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", () => window.switchDarwinStory(idx));
    });

    // Auto-rotate Hero Slider every 7s unless hovered
    const heroSec = document.querySelector(".dw-hero");
    let heroHovered = false;
    if (heroSec) {
      heroSec.addEventListener("mouseenter", () => { heroHovered = true; });
      heroSec.addEventListener("mouseleave", () => { heroHovered = false; });
      setInterval(() => {
        if (!heroHovered) {
          window.switchDarwinSlide(currentHeroSlide === 1 ? 2 : 1);
        }
      }, 7000);
    }
  });
})();
