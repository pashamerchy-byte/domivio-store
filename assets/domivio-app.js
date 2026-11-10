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
        raw.forEach((item) => {
          if (item.variantId === 1001 || item.variantId === 101) {
            item.variantId = 57832934801734;
          }
        });
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
    const legalModal = document.getElementById("legalModal");
    if (legalModal && legalModal.classList.contains("is-open") && typeof window.openLegalModal === "function") {
      window.openLegalModal(currentLegalTab);
    }
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
            ? `<li>✦ Engineered for deep REM & slow-wave sleep recovery</li><li>✦ Minimalist, zero-distraction bedroom aesthetics</li><li>✦ Complimentary shipping from 590 PLN</li>`
            : `<li>✦ Zaprojektowane dla głębokiej fazy REM i regeneracji nocnej</li><li>✦ Minimalistyczna, wyciszająca estetyka sypialni</li><li>✦ Darmowa dostawa od 590 zł</li>`;
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

  const CATEGORY_TITLE_KEYS = {
    "all": "hits_title",
    "poduszki": "nav_pillows",
    "koldra": "nav_duvets",
    "dla-dzieci": "nav_kids",
    "akcesoria": "nav_accessories",
    "zestawy": "nav_gifts"
  };

  window.resetToHome = function (ev) {
    if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
    if (window.closeProductModal) window.closeProductModal();
    window.filterCatalog("all");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.filterCatalog = function (cat) {
    currentCategory = cat || "all";
    renderCatalog();
  };

  let collectionOrderMap = {};

  function renderCatalog() {
    const titleKey = CATEGORY_TITLE_KEYS[currentCategory] || "hits_title";
    const sectionTitleEl = document.querySelector("#catalog .dw-section-title");
    if (sectionTitleEl) {
      sectionTitleEl.textContent = t(titleKey);
    }

    document.querySelectorAll("[data-filter-cat]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-filter-cat") === currentCategory);
    });

    document.querySelectorAll(".dw-nav__link, .dw-mobile-nav a").forEach((link) => {
      const oc = link.getAttribute("onclick") || "";
      const m = oc.match(/filterCatalog\(['"]([^'"]+)['"]\)/);
      if (m) {
        const linkCat = m[1];
        link.classList.toggle(
          "is-active",
          currentCategory === "all" ? linkCat === "all" : linkCat === currentCategory
        );
      } else {
        link.classList.remove("is-active");
      }
    });

    const grid = document.getElementById("productGrid");
    if (!grid) return;

    const list = PRODUCTS.filter((p) => {
      if (currentCategory === "all") return true;
      return p.category && p.category.includes(currentCategory);
    }).slice();

    if (currentCategory !== "all" && collectionOrderMap[currentCategory]) {
      const colOrder = collectionOrderMap[currentCategory];
      list.sort((a, b) => {
        const tagA = typeof a.sortTagOrder === "number" ? a.sortTagOrder : 999999;
        const tagB = typeof b.sortTagOrder === "number" ? b.sortTagOrder : 999999;
        if (tagA !== tagB) return tagA - tagB;
        const idxA = colOrder.indexOf(String(a.id));
        const idxB = colOrder.indexOf(String(b.id));
        const posA = idxA !== -1 ? idxA : 999999;
        const posB = idxB !== -1 ? idxB : 999999;
        return posA - posB;
      });
    }

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
        const savePct = comp && comp > price ? Math.round(((comp - price) / comp) * 100) : 0;
        const catLabel = currentLang === "en" ? (p.catLabelEN || "SLEEP") : (p.catLabelPL || "PODUSZKI");
        const heroImg = resolveAsset((p.images && p.images[0]) || "domivio_wave_1.jpg");

        return `
          <article class="dw-card">
            <div class="dw-card__box" onclick="openProductModal('${p.handle}')">
              <img class="dw-card__img" src="${heroImg}" alt="${p.title[currentLang]}" width="320" height="320" loading="lazy" decoding="async" />
            </div>
            <div class="dw-card__info">
              <div class="dw-card__cat">${catLabel}</div>
              <h3 class="dw-card__title" onclick="openProductModal('${p.handle}')">${p.title[currentLang]}</h3>
              <div class="dw-card__price-row">
                <span class="dw-card__price">${formatValue(price)}</span>
                ${comp && comp > price ? `<span class="dw-card__old">${formatValue(comp)}</span>` : ""}
                ${savePct > 0 ? `<span class="dw-card__disc">-${savePct}%</span>` : ""}
              </div>
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
  let savedHomeScrollY = 0;
  let isHandlingPopState = false;

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

    const wasOnHome = homeView && homeView.style.display !== "none";
    if (wasOnHome) {
      savedHomeScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    }
    if (!preserveScroll && !isHandlingPopState) {
      try {
        if (wasOnHome) {
          history.replaceState(
            { domivioView: "home", category: currentCategory, scrollY: savedHomeScrollY },
            ""
          );
        }
        history.pushState(
          { domivioView: "pdp", handle: prod.handle, category: currentCategory, scrollY: savedHomeScrollY },
          "",
          "#produkt-" + prod.handle
        );
      } catch (e) {}
    }

    const unitPrice = getProductPrice(prod);
    const unitComp = getProductCompare(prod);

    const p1 = unitPrice;
    const p2Orig = unitPrice * 2;
    const p2Disc = p2Orig * 0.95;
    const p3Orig = unitPrice * 3;
    const p3Disc = p3Orig * 0.9;

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
          return `
            <div class="dw-pdp__img-box dw-pdp__img-box--hero">
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
        <div class="dw-pdp__pack-pills">
          <button type="button" class="dw-pdp__pack-pill ${activePdpPackQty === 1 ? "is-active" : ""}" onclick="openProductModal('${prod.handle}', 1, true)">
            1 ${currentLang === "en" ? "pc." : "szt."} — ${formatValue(p1)}
          </button>
          <button type="button" class="dw-pdp__pack-pill ${activePdpPackQty === 2 ? "is-active" : ""}" onclick="openProductModal('${prod.handle}', 2, true)">
            2 ${currentLang === "en" ? "pcs" : "szt."} <span>-5%</span>
          </button>
          <button type="button" class="dw-pdp__pack-pill ${activePdpPackQty === 3 ? "is-active" : ""}" onclick="openProductModal('${prod.handle}', 3, true)">
            3 ${currentLang === "en" ? "pcs" : "szt."} <span>-10%</span>
          </button>
        </div>
      </div>
    `;

    const addonHtml = "";

    let tabDrawerHtml = "";
    if (activePdpAccordionTab === "opis") {
      const rawOpis = (prod.opisText && prod.opisText[currentLang]) || (prod.shortDesc && prod.shortDesc[currentLang]) || "";
      const opisLines = String(rawOpis).split("\n").map((l) => l.trim()).filter(Boolean);
      const paragraphsHtml = opisLines.map((line) => `<p style="margin-bottom:8px;">${line}</p>`).join("");
      const bulletsList = (prod.bullets && prod.bullets[currentLang]) || [];
      tabDrawerHtml = `
        <div class="dw-pdp__tab-drawer">
          ${paragraphsHtml}
          ${bulletsList.length && !prod.hasCustomOpis ? `<ul>${bulletsList.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}
        </div>
      `;
    } else if (activePdpAccordionTab === "charakterystyka") {
      const customChar = (prod.charakterystykaText && prod.charakterystykaText[currentLang]) || "";
      if (customChar.trim()) {
        const charLines = customChar.split("\n").map((l) => l.trim()).filter(Boolean);
        const rowsHtml = charLines
          .map((line) => {
            const colonIdx = line.indexOf(":");
            if (colonIdx > 0) {
              const label = line.slice(0, colonIdx + 1).trim();
              const val = line.slice(colonIdx + 1).trim();
              return `<div class="dw-pdp__spec-line"><span>${label}</span><strong>${val}</strong></div>`;
            }
            return `<div class="dw-pdp__spec-line"><strong>${line}</strong></div>`;
          })
          .join("");
        tabDrawerHtml = `<div class="dw-pdp__tab-drawer">${rowsHtml}</div>`;
      } else {
        tabDrawerHtml = `
          <div class="dw-pdp__tab-drawer">
            <div class="dw-pdp__spec-line"><span>Materiał rdzenia:</span><strong>100% hipoalergiczny elastomer TPE CELL®</strong></div>
            <div class="dw-pdp__spec-line"><span>Poszewka zewnętrzna:</span><strong>Włókno chłodzące Tencel™ (zdejmowana, do prania)</strong></div>
            <div class="dw-pdp__spec-line"><span>Wymiary / profil:</span><strong>${currentSz || specHeight}</strong></div>
            <div class="dw-pdp__spec-line"><span>Twardość:</span><strong>${specFirm}</strong></div>
            <div class="dw-pdp__spec-line"><span>Żywotność:</span><strong>10.000 cykli mycia / do 10 lat bez odkształceń</strong></div>
          </div>
        `;
      }
    } else if (activePdpAccordionTab === "detale") {
      const customDetale = (prod.detaleText && prod.detaleText[currentLang]) || "";
      if (customDetale.trim()) {
        const detLines = customDetale.split("\n").map((l) => l.trim()).filter(Boolean);
        tabDrawerHtml = `
          <div class="dw-pdp__tab-drawer">
            ${detLines.map((line) => `<p style="margin-bottom:8px;">${line}</p>`).join("")}
          </div>
        `;
      } else {
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
    }

    pdpView.innerHTML = `
      <div class="dw-container">
        <!-- Breadcrumbs (1:1 Darwin) -->
        <nav class="dw-pdp__breadcrumbs" aria-label="Breadcrumb">
          <a href="#" onclick="event.preventDefault(); closeProductModal();">${currentLang === "en" ? "Home" : "Główna"}</a>
          <span>/</span>
          <a href="#catalog" onclick="event.preventDefault(); closeProductModal();">${currentLang === "en" ? "Catalog" : "Katalog"}</a>
          <span>/</span>
          <a href="#catalog" onclick="event.preventDefault(); closeProductModal();">${catBreadcrumb}</a>
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
                ${origCompareTotal > displayGrandTotal ? `<span class="dw-pdp__sale-word">${currentLang === "en" ? "SALE" : "RABAT"}</span>` : ""}
              </h1>
            </div>

            <div class="dw-pdp__price-row">
              <span class="dw-pdp__price">${formatValue(displayGrandTotal)}</span>
              ${origCompareTotal > displayGrandTotal ? `<span class="dw-pdp__old">${formatValue(origCompareTotal)}</span>` : ""}
              ${savePct > 0 ? `<span class="dw-pdp__disc">-${savePct}%</span>` : ""}
            </div>

            ${sizeAndPackHtml}
            ${addonHtml}

            <button type="button" class="dw-pdp__atc-btn" onclick="addPdpSelectionToCart(${prod.variantId}, ${activePdpPackQty})">
              ${t("btn_add_to_cart")}
            </button>

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
          </div>
        </div>
      </div>
    `;

    if (homeView) homeView.style.display = "none";
    pdpView.style.display = "block";
    if (!preserveScroll) {
      window.scrollTo({ top: 0, behavior: "instant" });
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

  window.closeProductModal = function (fromPopState) {
    const modal = document.getElementById("pdpModal");
    if (modal) modal.classList.remove("is-open");
    const pdpView = document.getElementById("pdpPageView");
    const homeView = document.getElementById("homeMainView");
    const wasPdpOpen = Boolean(activePdpProduct) || (pdpView && pdpView.style.display !== "none");
    if (pdpView) pdpView.style.display = "none";
    if (homeView) homeView.style.display = "block";
    activePdpProduct = null;
    if (wasPdpOpen) {
      window.scrollTo({ top: savedHomeScrollY, behavior: "instant" });
      document.documentElement.scrollTop = savedHomeScrollY;
      document.body.scrollTop = savedHomeScrollY;
    }
    if (!fromPopState && window.location.hash.startsWith("#produkt-")) {
      try {
        history.replaceState(
          { domivioView: "home", category: currentCategory, scrollY: savedHomeScrollY },
          "",
          window.location.pathname + window.location.search
        );
      } catch (e) {}
    }
  };

  window.addEventListener("popstate", (event) => {
    const state = event.state || {};
    const hash = window.location.hash || "";
    if (state.domivioView === "pdp" && state.handle) {
      isHandlingPopState = true;
      window.openProductModal(state.handle, 1, false);
      isHandlingPopState = false;
    } else if (hash.startsWith("#produkt-")) {
      const h = decodeURIComponent(hash.replace("#produkt-", ""));
      isHandlingPopState = true;
      window.openProductModal(h, 1, false);
      isHandlingPopState = false;
    } else {
      const pdpView = document.getElementById("pdpPageView");
      if (activePdpProduct || (pdpView && pdpView.style.display !== "none")) {
        isHandlingPopState = true;
        if (state.category) {
          currentCategory = state.category;
          renderCatalog();
        }
        if (typeof state.scrollY === "number") {
          savedHomeScrollY = state.scrollY;
        }
        window.closeProductModal(true);
        isHandlingPopState = false;
      }
    }
  });

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
      if (item.qty === 2) lineTotal = lineTotal * 0.95;
      else if (item.qty >= 3) lineTotal = lineTotal * 0.9;
      subtotal += lineTotal;
      totalCount += item.qty;
    });

    const discountAmount = 0;
    const totalAfterDiscount = subtotal;
    const threshold = currentLang === "en" ? (CFG.freeShippingEUR || 139.0) : (CFG.freeShippingPLN || 590.0);
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
    let shippingMethodLabel = selectedLocker && selectedLocker.code
      ? `${selectedLocker.supplier || "PACZKOMAT"} ${selectedLocker.code}`
      : "Paczkomat";

    const grandTotal = totalAfterDiscount;

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
          lineTotal *= 0.95;
          packBadge = `<span style="background:#7B42F6;color:#FFF;padding:2px 6px;font-size:10px;font-weight:600;margin-left:6px;">-5% PAKIET</span>`;
        } else if (item.qty >= 3) {
          lineTotal *= 0.9;
          packBadge = `<span style="background:#7B42F6;color:#FFF;padding:2px 6px;font-size:10px;font-weight:600;margin-left:6px;">-10% PAKIET</span>`;
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

    const selectedPointHtml =
      selectedLocker && selectedLocker.code
        ? `
          <div class="locker-selected" style="margin-bottom:10px;border:1.5px solid #7B42F6;background:#F6F3FF;padding:12px;">
            <div>
              <span class="locker-selected__badge" style="background:#7B42F6;color:#FFF;padding:2px 7px;font-size:10px;font-weight:700;display:inline-block;margin-bottom:4px;">✓ ${selectedLocker.supplier === "DPD" ? "DPD PICKUP / PACZKOMAT" : "INPOST PACZKOMAT"}</span>
              <div style="font-size:13.5px;font-weight:700;color:#242C34;">${selectedLocker.code}</div>
              <div style="font-size:11.5px;color:#475569;">${selectedLocker.street}, ${selectedLocker.postal_code} ${selectedLocker.city}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <button type="button" class="acc-card__btn" style="background:#7B42F6;color:#FFF;border:none;padding:5px 10px;font-size:10.5px;font-weight:700;cursor:pointer;" onclick="openApaczkaLockerMap('${selectedLocker.supplier || "ALL"}')">${t("locker_change_btn")}</button>
              <button type="button" style="background:none;border:none;font-size:10.5px;font-weight:700;color:#7B42F6;cursor:pointer;" onclick="clearSelectedLocker()">${t("locker_remove_btn")}</button>
            </div>
          </div>
        `
        : "";

    const lockerHtml = `
      <div class="locker-box" style="background:#F6F3FF;border:1.5px solid #EDE5FF;padding:14px;">
        <div class="locker-box__title" style="color:#7B42F6;font-size:11.5px;font-weight:800;letter-spacing:0.05em;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7B42F6" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          <span>${t("locker_title")}</span>
        </div>
        ${selectedPointHtml}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button
            type="button"
            onclick="selectShippingMethod('inpost_paczkomat'); openApaczkaLockerMap('INPOST');"
            style="padding:12px 10px;background:#7B42F6;border:1.5px solid #7B42F6;font-size:12px;font-weight:700;color:#FFFFFF;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.15s;"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>InPost Paczkomat</span>
          </button>
          <button
            type="button"
            onclick="selectShippingMethod('dpd_paczkomat'); openApaczkaLockerMap('DPD');"
            style="padding:12px 10px;background:#7B42F6;border:1.5px solid #7B42F6;font-size:12px;font-weight:700;color:#FFFFFF;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.15s;"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>DPD Paczkomat</span>
          </button>
        </div>
      </div>
    `;

    upsellWrap.innerHTML = lockerHtml;

    // Summary totals (safe support for both ID naming conventions)
    const subEl = document.getElementById("cartSubtotalVal") || document.getElementById("summarySubtotal");
    if (subEl) subEl.textContent = formatValue(totals.subtotal);

    const discRow = document.getElementById("summaryDiscountRow");
    if (discRow) discRow.style.display = "none";

    const shipRow = document.getElementById("cartShippingRow");
    if (shipRow) shipRow.style.display = "none";

    const totEl = document.getElementById("cartTotalVal") || document.getElementById("summaryTotal");
    if (totEl) totEl.textContent = formatValue(totals.grandTotal);
  }

  let _cartLockerTimer = null;
  let _cartLockerAbort = null;
  let _cartLockerCache = [];

  window.handleCartInlineLockerSearch = function (rawQuery) {
    const q = (rawQuery || "").trim();
    const resBox = document.getElementById("cartInlineLockerResults");
    if (!resBox) return;
    if (_cartLockerTimer) clearTimeout(_cartLockerTimer);
    if (q.length < 2) {
      resBox.style.display = "none";
      resBox.innerHTML = "";
      return;
    }
    _cartLockerTimer = setTimeout(async () => {
      try {
        if (_cartLockerAbort) _cartLockerAbort.abort();
        _cartLockerAbort = new AbortController();
        resBox.style.display = "block";
        resBox.innerHTML = `<div style="padding:10px 12px;font-size:12px;color:#64748B;">Szukam Paczkomatów...</div>`;
        const list = await fetchMatchingLockers(q, _cartLockerAbort.signal);
        _cartLockerCache = list || [];
        if (!_cartLockerCache.length) {
          resBox.innerHTML = `<div style="padding:10px 12px;font-size:12px;color:#64748B;">Brak wyników — kliknij "Wybierz Paczkomat na mapie" poniżej.</div>`;
          return;
        }
        resBox.innerHTML = _cartLockerCache
          .map(
            (lk, idx) => `
            <div
              onclick="pickInlineCartLocker(${idx})"
              style="padding:9px 12px;border-bottom:1px solid #F1F5F9;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;"
            >
              <div>
                <div style="font-size:12px;font-weight:700;color:#242C34;">[${lk.supplier}] ${lk.code} — ${lk.street}</div>
                <div style="font-size:11px;color:#64748B;">${lk.postal_code} ${lk.city}</div>
              </div>
              <span style="background:#7B42F6;color:#FFF;padding:4px 8px;font-size:10.5px;font-weight:700;white-space:nowrap;">WYBIERZ ✓</span>
            </div>
          `
          )
          .join("");
      } catch (e) {}
    }, 180);
  };

  window.pickInlineCartLocker = function (idx) {
    const lk = _cartLockerCache[idx];
    if (!lk) return;
    selectedShippingMethod = lk.supplier === "DPD" ? "dpd_paczkomat" : "inpost_paczkomat";
    localStorage.setItem(STORAGE_SHIP_KEY, selectedShippingMethod);
    saveLocker({
      code: lk.code,
      supplier: lk.supplier,
      street: lk.street,
      postal_code: lk.postal_code,
      city: lk.city
    });
  };

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
      `${totals.shippingMethodLabel} (${totals.shippingCost === 0 ? "0,00 zł GRATIS od 590 zł" : formatValue(totals.shippingCost)})`
    );

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
    params.set("skip_shop_pay", "true");

    const checkoutHost = CFG.shopDomain || CFG.myshopifyDomain;
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
  // 3.5 POLISH E-COMMERCE LEGAL POLICIES MODAL (Regulamin, RODO, Zwroty, Dostawa)
  // ══════════════════════════════════════════════════════════════════════════
  const LEGAL_DOCS = {
    pl: {
      tabs: [
        { key: "regulamin", label: "Regulamin sklepu" },
        { key: "prywatnosc", label: "Polityka prywatności i RODO" },
        { key: "zwroty", label: "Zwroty i reklamacje (14 dni)" },
        { key: "dostawa", label: "Dostawa i płatności" },
      ],
      regulamin: `
        <div class="legal-doc">
          <span class="legal-doc__badge">Obowiązuje od: 01.11.2026 r. · Zgodny z Ustawą o prawach konsumenta, Kodeksem cywilnym i Dyrektywą Omnibus</span>
          <h2>Regulamin Sklepu Internetowego Domivio</h2>
          <p class="legal-doc__meta">Sklep internetowy działający pod adresem <strong>https://domivio-official.com</strong></p>

          <div class="legal-doc__box">
            <strong>Najważniejsze informacje w skrócie:</strong> Wysyłka z magazynu w Polsce · Darmowa dostawa <strong>od 590,00 zł</strong> · Prawo odstąpienia od umowy w ciągu <strong>14 dni</strong> dla nieużywanych produktów w stanie nienaruszonym (z uwzględnieniem wyjątków higienicznych z art. 38 pkt 5 Ustawy o prawach konsumenta).
          </div>

          <h3>§ 1. Postanowienia ogólne i dane kontaktowe</h3>
          <p>1. Niniejszy Regulamin określa zasady korzystania ze sklepu internetowego <strong>Domivio</strong> dostępnego pod adresem <strong>https://domivio-official.com</strong>, świadczenia usług drogą elektroniczną, składania zamówień, dostarczania Produktów, uiszczania ceny sprzedaży, zasad odstąpienia od umowy oraz rozpatrywania reklamacji.</p>
          <p>2. Kontakt ze Sprzedawcą oraz Biurem Obsługi Klienta (BOK) jest możliwy za pośrednictwem:</p>
          <ul>
            <li>Adresu poczty elektronicznej (e-mail): <strong>domivio.official@gmail.com</strong></li>
            <li>Numeru telefonu: <strong>+48 790 532 905</strong> (czynny od poniedziałku do soboty w godz. 09:00–20:00)</li>
          </ul>
          <p>3. Postanowienia niniejszego Regulaminu nie wyłączają ani nie ograniczają praw Konsumenta (oraz Przedsiębiorcy na prawach konsumenta zgodnie z art. 385<sup>5</sup> Kodeksu cywilnego) wynikających z bezwzględnie obowiązujących przepisów prawa polskiego, w szczególności Ustawy z dnia 30 maja 2014 r. o prawach konsumenta (Dz.U. 2014 poz. 827 ze zm.).</p>

          <h3>§ 2. Definicje</h3>
          <ul>
            <li><strong>Konsument</strong> – osoba fizyczna dokonująca ze Sprzedawcą czynności prawnej niezwiązanej bezpośrednio z jej działalnością gospodarczą lub zawodową, a także osoba fizyczna zawierająca umowę bezpośrednio związaną z jej działalnością gospodarczą, gdy z treści tej umowy wynika, że nie posiada ona dla tej osoby charakteru zawodowego (Przedsiębiorca na prawach konsumenta).</li>
            <li><strong>Klient B2B (Przedsiębiorca)</strong> – podmiot dokonujący zakupu w ramach działalności gospodarczej lub zawodowej o charakterze zawodowym.</li>
            <li><strong>Sklep</strong> – serwis internetowy prowadzony pod adresem <strong>https://domivio-official.com</strong>.</li>
            <li><strong>Towar / Produkt</strong> – rzecz ruchoma dostępna w Sklepie (w szczególności poduszki ortopedyczne, poduszki dla dzieci, poszewki, akcesoria ergonomiczne oraz treści cyfrowe), będąca przedmiotem Umowy Sprzedaży.</li>
          </ul>

          <h3>§ 3. Usługi elektroniczne i wymagania techniczne</h3>
          <p>1. Zgodnie z Ustawą z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną, Sprzedawca świadczy nieodpłatnie usługi elektroniczne umożliwiające przeglądanie oferty Sklepu, korzystanie z koszyka zakupowego, wybór punktu odbioru z mapy Paczkomat® InPost / DPD Pickup oraz złożenie zamówienia.</p>
          <p>2. Wymagania techniczne: urządzenie z dostępem do Internetu, aktualna przeglądarka z obsługą JavaScript i Cookies, aktywny adres e-mail oraz numer telefonu komórkowego do obsługi powiadomień przewoźnika.</p>

          <h3>§ 4. Produkty, ceny, rabaty zestawowe i Dyrektywa Omnibus</h3>
          <p>1. Informacje prezentowane na stronach Sklepu stanowią zaproszenie do zawarcia umowy w rozumieniu art. 71 Kodeksu cywilnego. Zdjęcia Produktów mają charakter poglądowy – dopuszczalne są minimalne różnice w odcieniu wynikające z indywidualnych ustawień ekranu Klienta oraz naturalna tolerancja wymiarowa wyrobów elastomerowych i tekstylnych (±1,5 cm), co nie stanowi niezgodności Towaru z umową.</p>
          <p>2. Wszystkie ceny podane w Sklepie wyrażone są w <strong>polskich złotych (PLN)</strong> i są cenami <strong>brutto</strong>. Ceny nie zawierają kosztów dostawy, które są doliczane zgodnie z cennikiem w koszyku i przy kasie.</p>
          <p>3. Zgodnie z wymogami <strong>Dyrektywy Omnibus</strong> (art. 4 ust. 2 ustawy o informowaniu o cenach towarów i usług), przy każdej obniżce ceny uwidaczniana jest najniższa cena Produktu z okresu 30 dni przed wprowadzeniem obniżki.</p>
          <p>4. W Sklepie obowiązują warunkowe rabaty zestawowe: przy zakupie <strong>2 sztuk – rabat 5%</strong>, przy zakupie <strong>3 sztuk – rabat 10%</strong>. W przypadku częściowego odstąpienia od umowy (zwrotu części produktów z zestawu), przez co liczba zachowanych przez Klienta produktów spadnie poniżej progu uprawniającego do rabatu zestawowego lub progu darmowej dostawy (590,00 zł), rabat ten traci moc, a cena zachowanych przez Klienta produktów oraz koszt pierwotnej dostawy zostają przeliczone według ceny regularnej i potrącone z kwoty zwrotu.</p>

          <h3>§ 5. Składanie zamówień, dostawa i nieodebranie przesyłki</h3>
          <p>1. Umowa Sprzedaży zostaje zawarta z chwilą potwierdzenia przyjęcia zamówienia po autoryzacji płatności elektronicznej.</p>
          <p>2. Koszty dostawy na terenie Polski wynoszą: <strong>InPost Paczkomat® 24/7 – 24,90 zł</strong>, <strong>DPD Paczkomat / Punkt Pickup – 24,90 zł</strong>, <strong>Kurier DPD – 29,90 zł</strong>. Przy zamówieniach o wartości <strong>od 590,00 zł brutto dostawa jest darmowa (0,00 zł)</strong>.</p>
          <p>3. Klient zobowiązany jest do podania prawidłowych danych adresowych i odebrania zamówionej przesyłki w terminie wyznaczonym przez przewoźnika (48h w przypadku Paczkomatu®). Samo nieodebranie przesyłki nie stanowi oświadczenia o odstąpieniu od umowy. W przypadku zwrotu nieodebranej paczki do nadawcy z przyczyn leżących po stronie Klienta, Sprzedawca jest uprawniony do obciążenia Klienta rzeczywistymi kosztami powrotnego transportu naliczonymi przez przewoźnika oraz kosztami ponownego nadania.</p>
          <p>4. Przy odbiorze przesyłki Klient powinien zbadać stan zewnętrzny opakowania. W razie stwierdzenia uszkodzenia paczki zaleca się sporządzenie Protokołu Szkody w obecności kuriera lub bezpośrednio przy ekranie Paczkomatu® oraz niezwłoczne poinformowanie BOK.</p>

          <h3>§ 6. Prawo odstąpienia od umowy (14 dni), wyjątki higieniczne i zmniejszenie wartości Towaru</h3>
          <p>1. Konsumentowi przysługuje prawo do odstąpienia od umowy zawartej na odległość w terminie <strong>14 dni kalendarzowych</strong> od dnia objęcia Produktu w posiadanie (art. 27 Ustawy o prawach konsumenta), z zastrzeżeniem ust. 3–7 poniżej.</p>
          <p>2. Bezpośrednie koszty odesłania zwracanego Produktu do magazynu Sprzedawcy ponosi w całości Konsument (art. 34 ust. 2 Ustawy o prawach konsumenta). Sprzedawca nie przyjmuje przesyłek wysyłanych „za pobraniem” (COD) ani przesyłek nadanych do automatów paczkowych (Paczkomatów®).</p>
          <p>3. <strong>Wyłączenie prawa zwrotu ze względów higienicznych (art. 38 ust. 1 pkt 5 Ustawy o prawach konsumenta):</strong> Prawo odstąpienia od umowy <strong>nie przysługuje</strong> Konsumentowi w odniesieniu do umowy, w której przedmiotem świadczenia jest Towar dostarczany w zapieczętowanym opakowaniu ochronnym/higienicznym (dotyczy w szczególności poduszek do snu, poduszek niemowlęcych i poszewek mających bezpośredni kontakt ze skórą głowy, twarzą i drogami oddechowymi), którego po otwarciu opakowania ochronnego nie można zwrócić ze względu na ochronę zdrowia lub ze względów higienicznych, jeżeli opakowanie to zostało otwarte po dostarczeniu.</p>
          <p>4. <strong>Wyłączenie prawa zwrotu dla treści cyfrowych (art. 38 ust. 1 pkt 13 Ustawy o prawach konsumenta):</strong> Prawo odstąpienia od umowy nie przysługuje w odniesieniu do treści cyfrowych (np. poradników E-book PDF) niedostarczanych na nośniku materialnym.</p>
          <p>5. <strong>Odpowiedzialność finansowa za zmniejszenie wartości Towaru (art. 34 ust. 4 Ustawy o prawach konsumenta):</strong> Konsument ponosi pełną odpowiedzialność za zmniejszenie wartości Towaru będące wynikiem korzystania z niego w sposób wykraczający poza konieczny do stwierdzenia charakteru, cech i funkcjonowania Towaru (jak w sklepie stacjonarnym). W przypadku zwrócenia Produktu noszącego jakiekolwiek ślady użytkowania (w szczególności: spania na poduszce, zabrudzeń, plam, zapachów obcych/perfum/potu, sierści zwierząt, wyprania poszewki, zerwania metek lub zniszczenia oryginalnego opakowania produktowego), Sprzedawca ma ustawowe prawo pomniejszyć zwracaną kwotę o wartość utraty wartości handlowej Produktu (włącznie z kosztami profesjonalnej dekontaminacji, wymiany poszewki i opakowania lub utratą do 100% wartości handlowej, jeżeli ze względów sanitarnych używany produkt nie nadaje się do dalszej odsprzedaży).</p>
          <p>6. <strong>Wstrzymanie zwrotu płatności i koszt najtańszej dostawy (art. 32 ust. 3 i art. 33 Ustawy o prawach konsumenta):</strong> Sprzedawca wstrzymuje się ze zwrotem płatności do chwili fizycznego otrzymania Towaru z powrotem i weryfikacji jego stanu w magazynie. Jeżeli Konsument wybrał sposób dostawy Towaru inny niż najtańszy zwykły sposób dostawy dostępny w Sklepie, Sprzedawca nie jest zobowiązany do zwrotu poniesionych przez Konsumenta dodatkowych kosztów.</p>

          <h3>§ 7. Odpowiedzialność za zgodność Towaru z umową, brak dodatkowej gwarancji i reklamacje</h3>
          <p>1. Sprzedawca nie udziela na Produkty żadnej dodatkowej dobrowolnej gwarancji komercyjnej w rozumieniu art. 577 Kodeksu cywilnego. Wobec Konsumentów obowiązują wyłącznie ustawowe przepisy o odpowiedzialności za brak zgodności Towaru z umową istniejący w chwili jego dostarczenia i ujawniony w ciągu 2 lat od tej chwili (Rozdział 5a Ustawy o prawach konsumenta).</p>
          <p>2. Zgodnie z art. 43d i 43e Ustawy o prawach konsumenta, w przypadku stwierdzenia braku zgodności Towaru z umową Konsumentowi przysługuje w pierwszej kolejności uprawnienie do doprowadzenia Towaru do zgodności z umową poprzez <strong>naprawę lub wymianę</strong>. Oświadczenie o obniżeniu ceny albo odstąpieniu od umowy może zostać złożone wyłącznie w przypadkach ściśle określonych w art. 43e Ustawy (gdy naprawa i wymiana są niemożliwe lub brak zgodności jest istotny).</p>
          <p>3. Sprzedawca nie ponosi odpowiedzialności za uszkodzenia i zmiany powstałe po dostarczeniu Towaru wskutek: uszkodzeń mechanicznych (przecięcia, rozdarcia siatki TPE lub zamka), nieprawidłowej konserwacji i prania niezgodnie z instrukcją na metce (np. prania wkładu w pralce, suszenia w suszarce bębnowej, stosowania wybielaczy), naturalnego zużycia eksploatacyjnego poszewki, ani za subiektywne odczucia twardości lub profilu poduszki, które wymagają naturalnego okresu adaptacji odcinka szyjnego (ok. 7–14 dni).</p>
          <p>4. W celu rozpatrzenia reklamacji Klient zobowiązany jest przesłać zgłoszenie na adres <strong>domivio.official@gmail.com</strong> wraz z numerem zamówienia, dokładnym opisem wady oraz dokumentacją fotograficzną, a na wniosek Sprzedawcy – udostępnić reklamowany Towar (w stanie czystym i higienicznym) do ekspertyzy w magazynie Sprzedawcy.</p>

          <h3>§ 8. Postanowienia dotyczące Klientów B2B (wyłączenie rękojmi)</h3>
          <p>1. W stosunku do Klientów B2B (niebędących Konsumentami ani Przedsiębiorcami na prawach konsumenta), na podstawie <strong>art. 558 § 1 Kodeksu cywilnego</strong> odpowiedzialność Sprzedawcy z tytułu rękojmi za wady fizyczne i prawne Produktu zostaje <strong>całkowicie wyłączona</strong>.</p>
          <p>2. Klientom B2B nie przysługuje ustawowe prawo do odstąpienia od umowy w terminie 14 dni. Z chwilą wydania Produktu przewoźnikowi na Klienta B2B przechodzą korzyści i ciężary związane z Produktem oraz niebezpieczeństwo jego przypadkowej utraty lub uszkodzenia (art. 548 § 1 KC).</p>
          <p>3. Całkowita odpowiedzialność odszkodowawcza Sprzedawcy względem Klienta B2B, bez względu na jej podstawę prawną, jest ograniczona do wysokości zapłaconej ceny netto za Produkt, a Sprzedawca nie ponosi odpowiedzialności z tytułu utraconych korzyści (<em>lucrum cessans</em>).</p>

          <h3>§ 9. Pozasądowe rozwiązywanie sporów i postanowienia końcowe</h3>
          <p>1. Konsument posiada możliwość skorzystania z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń (ADR). Informacje dostępne są na stronie UOKiK: <strong>https://polubowne.uokik.gov.pl</strong>. Skorzystanie z pozasądowych sposobów rozpatrywania sporów ma charakter dobrowolny i wymaga zgody obu stron.</p>
          <p>2. Prawem właściwym dla umów zawieranych w Sklepie jest prawo polskie.</p>
        </div>
      `,
      prywatnosc: `
        <div class="legal-doc">
          <span class="legal-doc__badge">Zgodna z RODO (Rozporządzenie UE 2016/679) oraz Prawem komunikacji elektronicznej</span>
          <h2>Polityka Prywatności i Plików Cookies (RODO)</h2>
          <p class="legal-doc__meta">Klauzula informacyjna RODO (art. 13 i 14) dla Klientów sklepu <strong>https://domivio-official.com</strong></p>

          <div class="legal-doc__box">
            Twoje dane są szyfrowane protokołem <strong>SSL/TLS</strong> i przetwarzane wyłącznie w celu realizacji Twojego zamówienia, dostawy do Paczkomatu® InPost / DPD oraz wypełnienia obowiązków księgowych i prawnych.
          </div>

          <h3>1. Administrator Danych Osobowych</h3>
          <p>Administratorem Twoich danych osobowych przekazywanych podczas korzystania ze sklepu internetowego <strong>Domivio (https://domivio-official.com)</strong> jest podmiot prowadzący sklep Domivio Polska. We wszystkich sprawach związanych z ochroną danych osobowych oraz realizacją praw wynikających z RODO możesz skontaktować się bezpośrednio pod adresem e-mail: <strong>domivio.official@gmail.com</strong> lub telefonicznie pod numerem <strong>+48 790 532 905</strong> (pon.–sob. 09:00–20:00).</p>

          <h3>2. Cele i podstawy prawne przetwarzania danych (art. 6 RODO)</h3>
          <p>Twoje dane osobowe (imię, nazwisko, adres dostawy lub kod wybranego punktu odbioru Paczkomat® InPost / DPD Pickup, adres e-mail, numer telefonu oraz dane transakcyjne) przetwarzamy w następujących celach:</p>
          <ul>
            <li><strong>Zawarcie i wykonanie Umowy Sprzedaży</strong> (art. 6 ust. 1 lit. b RODO) – przyjęcie zamówienia, skompletowanie paczki, wygenerowanie etykiety przewozowej InPost/DPD oraz doręczenie zamówienia.</li>
            <li><strong>Wypełnienie obowiązków prawnych ciążących na Administratorze</strong> (art. 6 ust. 1 lit. c RODO) – prowadzenie dokumentacji księgowej i podatkowej oraz rozpatrywanie zgłoszeń konsumenckich.</li>
            <li><strong>Prawnie uzasadniony interes Administratora</strong> (art. 6 ust. 1 lit. f RODO) – obsługa korespondencji BOK, zapobieganie oszustwom płatniczym, weryfikacja zasadności roszczeń oraz ustalenie, dochodzenie lub obrona przed ewentualnymi roszczeniami.</li>
          </ul>

          <h3>3. Odbiorcy danych osobowych</h3>
          <p>W celu realizacji zamówienia i dostawy Twoje dane przekazywane są wyłącznie zaufanym podmiotom współpracującym ze Sklepem:</p>
          <ul>
            <li><strong>Platforma e-commerce:</strong> Shopify International Ltd. (certyfikowany system koszyka i realizacji zamówień zgodny ze standardem PCI DSS oraz RODO).</li>
            <li><strong>Przewoźnicy i operatorzy logistyczni:</strong> InPost Sp. z o.o. (dostawa do Paczkomatów® 24/7) oraz DPD Polska Sp. z o.o. (dostawa do automatów i punktów DPD Pickup oraz kurierem DPD).</li>
            <li><strong>Operatorzy płatności elektronicznych:</strong> licencjonowani operatorzy obsługujący płatności BLIK, Przelewy24, karty płatnicze Visa/Mastercard, Apple Pay oraz Google Pay.</li>
          </ul>

          <h3>4. Okres przechowywania danych</h3>
          <p>Dane osobowe przechowywane są przez czas niezbędny do wykonania umowy, przedawnienia ewentualnych roszczeń cywilnoprawnych oraz przez okres wymagany przepisami prawa podatkowego i rachunkowego (5 lat licząc od końca roku kalendarzowego, w którym dokonano zakupu).</p>

          <h3>5. Twoje prawa wynikające z RODO (art. 15–21 RODO)</h3>
          <p>Przysługuje Ci prawo do: dostępu do swoich danych oraz otrzymania ich kopii (art. 15 RODO), sprostowania danych (art. 16 RODO), usunięcia danych w przypadkach przewidzianych prawem (art. 17 RODO), ograniczenia przetwarzania (art. 18 RODO), przenoszenia danych (art. 20 RODO), wniesienia sprzeciwu (art. 21 RODO) oraz wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (PUODO, ul. Stawki 2, 00-193 Warszawa, <strong>https://uodo.gov.pl</strong>).</p>

          <h3>6. Pliki Cookies i pamięć lokalna przeglądarki (LocalStorage)</h3>
          <p>Sklep wykorzystuje pliki cookies oraz pamięć lokalną przeglądarki (<code>localStorage</code>) w celu działania koszyka zakupowego, zapamiętania wybranego na mapie punktu odbioru Paczkomat® InPost / DPD, języka strony (PL/EN) oraz celów statystycznych i analitycznych. Korzystanie ze Sklepu bez zmiany ustawień przeglądarki oznacza zgodę na zapisywanie tych danych w pamięci urządzenia.</p>
        </div>
      `,
      zwroty: `
        <div class="legal-doc">
          <span class="legal-doc__badge">Zgodne z art. 27–38 oraz Rozdziałem 5a Ustawy o prawach konsumenta</span>
          <h2>Zwroty i Reklamacje (14 dni na odstąpienie od umowy)</h2>
          <p class="legal-doc__meta">Szczegółowe zasady zwrotów konsumenckich, wyjątków higienicznych i reklamacji w sklepie <strong>Domivio (https://domivio-official.com)</strong></p>

          <div class="legal-doc__box">
            <strong>Ważna informacja higieniczna:</strong> Poduszki do snu i akcesoria niemowlęce są produktami mającymi bezpośredni kontakt ze skórą twarzy, głowy i drogami oddechowymi. Zwrotowi w trybie 14-dniowym podlegają <strong>wyłącznie produkty nowe, nieużywane, czyste, pozbawione zapachów i śladów spania</strong>, z kompletem metek i w oryginalnym opakowaniu.
          </div>

          <h3>1. Warunki odstąpienia od umowy w terminie 14 dni</h3>
          <p>1. Zgodnie z art. 27 Ustawy o prawach konsumenta, Konsument ma prawo odstąpić od umowy zawartej na odległość w terminie <strong>14 dni kalendarzowych</strong> od dnia odebrania przesyłki, z zastrzeżeniem przepisów dotyczących ochrony zdrowia i higieny (art. 38 ust. 1 pkt 5) oraz odpowiedzialności za zmniejszenie wartości towaru (art. 34 ust. 4).</p>
          <p>2. <strong>Wyjątek higieniczny (art. 38 ust. 1 pkt 5 Ustawy o prawach konsumenta):</strong> Prawo odstąpienia od umowy nie przysługuje w odniesieniu do Produktów dostarczanych w zapieczętowanym opakowaniu ochronnym/higienicznym, którego po otwarciu opakowania nie można zwrócić ze względu na ochronę zdrowia lub ze względów higienicznych, jeżeli opakowanie to zostało otwarte po dostarczeniu.</p>
          <p>3. <strong>Odpowiedzialność za zmniejszenie wartości Produktu (art. 34 ust. 4 Ustawy o prawach konsumenta):</strong> Konsument ma prawo zapoznać się z Produktem wyłącznie w taki sposób, w jaki mógłby to zrobić w sklepie stacjonarnym (krótka przymiarka z zachowaniem higieny, bez spania na poduszce przez noc i bez prania poszewki). Konsument ponosi pełną odpowiedzialność finansową za zmniejszenie wartości Produktu wynikające z korzystania z niego w sposób wykraczający poza zwykłe sprawdzenie. W przypadku stwierdzenia podczas weryfikacji magazynowej śladów użytkowania (zabrudzenia, plamy, sierść, włosy, zapach potu/perfum/dymu, wypranie poszewki, uszkodzenie pudełka), kwota zwrotu zostanie pomniejszona o kwotę odpowiadającą utracie wartości handlowej Produktu (do 100% wartości w przypadku konieczności utylizacji sanitarnej używanego wyrobu pościelowego).</p>

          <h3>2. Procedura zwrotu krok po kroku i koszty przesyłki</h3>
          <ul>
            <li><strong>Krok 1 (Zgłoszenie e-mail w ciągu 14 dni):</strong> Przed odesłaniem paczki wyślij oświadczenie o odstąpieniu od umowy wraz z numerem zamówienia na adres: <strong>domivio.official@gmail.com</strong>.</li>
            <li><strong>Krok 2 (Potwierdzenie i adres magazynu):</strong> Biuro Obsługi Klienta przekaże Ci dokładny adres magazynu zwrotów w Polsce oraz kod identyfikacyjny zwrotu.</li>
            <li><strong>Krok 3 (Odesłanie na koszt Kupującego):</strong> Zgodnie z art. 34 ust. 2 Ustawy o prawach konsumenta, <strong>bezpośredni koszt odesłania zwracanego Towaru ponosi Konsument</strong>. Paczkę należy odesłać w ciągu 14 dni od zgłoszenia bezpośrednio na wskazany adres magazynu. <strong>Nie odbieramy przesyłek wysyłanych „za pobraniem” (COD) ani paczek kierowanych do Paczkomatów®.</strong></li>
            <li><strong>Krok 4 (Weryfikacja magazynowa i zwrot środków):</strong> Zgodnie z art. 32 ust. 3 Ustawy o prawach konsumenta, zwrot środków następuje w terminie do 14 dni po fizycznym otrzymaniu przesyłki zwrotnej przez magazyn i pozytywnej weryfikacji stanu higienicznego Produktu. W przypadku częściowego zwrotu z zamówienia objętego rabatem zestawowym (2 szt. -5% / 3 szt. -10%) lub darmową dostawą od 590,00 zł, kwota zwrotu zostaje skorygowana o utraconą zniżkę zestawową oraz standardowy koszt pierwotnej dostawy (24,90 zł / 29,90 zł).</li>
          </ul>

          <h3>3. Zasady rozpatrywania reklamacji (zgodność Towaru z umową)</h3>
          <p>1. Sprzedawca nie udziela dodatkowej dobrowolnej gwarancji komercyjnej (art. 577 KC). Wobec Konsumentów odpowiada za brak zgodności Towaru z umową istniejący w chwili jego dostarczenia i ujawniony w ciągu 2 lat od tej chwili (Rozdział 5a Ustawy o prawach konsumenta). Wobec Klientów B2B rękojmia jest wyłączona na podstawie art. 558 § 1 KC.</p>
          <p>2. Zgłoszenie reklamacyjne należy przesłać drogą elektroniczną na adres: <strong>domivio.official@gmail.com</strong>, podając: numer zamówienia, dokładny opis stwierdzonej niezgodności oraz wyraźne zdjęcia ukazujące wadę i cały Produkt. Reklamacje rozpatrywane są w terminie <strong>14 dni kalendarzowych</strong>.</p>
          <p>3. Zgodnie z art. 43d Ustawy o prawach konsumenta, w przypadku zasadnej reklamacji Sprzedawca doprowadza Towar do zgodności z umową poprzez <strong>naprawę lub wymianę na nowy egzemplarz</strong>. Reklamacji nie podlegają uszkodzenia mechaniczne powstałe z winy użytkownika, skutki prania lub suszenia niezgodnie z instrukcją, zabrudzenia eksploatacyjne ani subiektywny brak dopasowania profilu poduszki.</p>

          <h3>4. Wzór formularza odstąpienia od umowy (do skopiowania w wiadomości e-mail)</h3>
          <table>
            <thead>
              <tr>
                <th>Pole formularza</th>
                <th>Dane do uzupełnienia w wiadomości na adres domivio.official@gmail.com</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Adresat</strong></td>
                <td>Biuro Obsługi Klienta Domivio – <strong>domivio.official@gmail.com</strong>, tel. +48 790 532 905</td>
              </tr>
              <tr>
                <td><strong>Oświadczenie</strong></td>
                <td>Niniejszym informuję o moim odstąpieniu od umowy sprzedaży następujących produktów: <em>[nazwa produktu]</em> oraz oświadczam, że produkt jest nieużywany i w stanie nienaruszonym.</td>
              </tr>
              <tr>
                <td><strong>Numer zamówienia i data odbioru</strong></td>
                <td>Zamówienie nr <em>[#...]</em> odebrane w dniu <em>[data odbioru przesyłki]</em></td>
              </tr>
              <tr>
                <td><strong>Dane Konsumenta</strong></td>
                <td>Imię i nazwisko, adres e-mail, numer telefonu</td>
              </tr>
            </tbody>
          </table>
        </div>
      `,
      dostawa: `
        <div class="legal-doc">
          <span class="legal-doc__badge">Wysyłka z magazynu w Polsce · Darmowa dostawa od 590,00 zł</span>
          <h2>Dostawa i Płatności</h2>
          <p class="legal-doc__meta">Aktualny cennik dostaw, czas realizacji i metody płatności w sklepie <strong>Domivio (https://domivio-official.com)</strong></p>

          <div class="legal-doc__box">
            Wszystkie zamówienia o wartości <strong>od 590,00 zł brutto (po uwzględnieniu rabatów) wysyłamy całkowicie ZA DARMO (0,00 zł)</strong> na terenie całej Polski – zarówno do Paczkomatów® InPost 24/7 i punktów DPD Pickup, jak i kurierem DPD pod drzwi.
          </div>

          <h3>1. Czas wysyłki i doręczenia przesyłki</h3>
          <p>Zamówienia kompletujemy i przekazujemy przewoźnikowi z naszego <strong>magazynu w Polsce zazwyczaj w ciągu 24 godzin roboczych</strong> (maksymalnie do 3 dni roboczych w okresach wzmożonych promocji) od momentu zaksięgowania płatności. Przewidywany czas doręczenia przesyłki przez przewoźników InPost oraz DPD wynosi <strong>1–2 dni robocze</strong> od momentu nadania. Po nadaniu paczki Klient otrzymuje powiadomienie e-mail oraz SMS / w aplikacji przewoźnika z numerem śledzenia.</p>

          <h3>2. Cennik i metody dostawy na terenie Polski</h3>
          <p>Podczas składania zamówienia w koszyku możesz wybrać dogodny Paczkomat® InPost lub punkt DPD Pickup na interaktywnej mapie całej Polski albo dostawę kurierską pod wskazany adres:</p>
          <table>
            <thead>
              <tr>
                <th>Metoda dostawy</th>
                <th>Przewidywany czas doręczenia</th>
                <th>Zamówienia poniżej 590,00 zł</th>
                <th>Zamówienia od 590,00 zł</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>InPost Paczkomat® 24/7</strong> (wybór z interaktywnej mapy w koszyku)</td>
                <td>1–2 dni robocze</td>
                <td><strong>24,90 zł</strong></td>
                <td><strong>0,00 zł (GRATIS)</strong></td>
              </tr>
              <tr>
                <td><strong>DPD Paczkomat / Punkt Pickup</strong> (wybór z mapy w koszyku)</td>
                <td>1–2 dni robocze</td>
                <td><strong>24,90 zł</strong></td>
                <td><strong>0,00 zł (GRATIS)</strong></td>
              </tr>
              <tr>
                <td><strong>Kurier DPD pod drzwi</strong> (dostawa bezpośrednio na wskazany adres)</td>
                <td>1–2 dni robocze</td>
                <td><strong>29,90 zł</strong></td>
                <td><strong>0,00 zł (GRATIS)</strong></td>
              </tr>
            </tbody>
          </table>

          <h3>3. Odbiór przesyłki i sprawdzenie stanu opakowania</h3>
          <p>1. Przesyłkę doręczoną do Paczkomatu® należy odebrać w terminie wyznaczonym przez operatora (standardowo 48 godzin). W przypadku nieodebrania przesyłki w terminie i jej zwrotu do magazynu, koszty zwrotnego transportu oraz ewentualnej ponownej wysyłki ponosi Klient.</p>
          <p>2. Zalecamy sprawdzenie stanu zewnętrznego opakowania przy odbiorze paczki. W przypadku zauważenia uszkodzeń transportowych prosimy o sporządzenie protokołu szkody z kurierem lub zgłoszenie uszkodzenia bezpośrednio na ekranie Paczkomatu® i kontakt z BOK (<strong>domivio.official@gmail.com</strong>).</p>

          <h3>4. Dostępne i bezpieczne metody płatności</h3>
          <p>Wszystkie transakcje w sklepie <strong>domivio-official.com</strong> realizowane są w formie przedpłaty elektronicznej chronionej certyfikatem SSL/TLS:</p>
          <ul>
            <li><strong>BLIK</strong> – błyskawiczna płatność 6-cyfrowym kodem z aplikacji mobilnej banku.</li>
            <li><strong>Szybkie przelewy internetowe (Przelewy24 / polskie banki)</strong> – natychmiastowe księgowanie wpłaty.</li>
            <li><strong>Karty płatnicze</strong> – Visa, Mastercard, Maestro.</li>
            <li><strong>Portfele cyfrowe</strong> – Apple Pay oraz Google Pay.</li>
          </ul>
        </div>
      `,
    },
    en: {
      tabs: [
        { key: "regulamin", label: "Terms & Conditions" },
        { key: "prywatnosc", label: "Privacy & GDPR Policy" },
        { key: "zwroty", label: "Returns & Claims (14 days)" },
        { key: "dostawa", label: "Shipping & Payment" },
      ],
      regulamin: `
        <div class="legal-doc">
          <span class="legal-doc__badge">Effective: 01.11.2026 · Compliant with Polish Consumer Rights Act, Civil Code & EU Omnibus Directive</span>
          <h2>Terms & Conditions of Domivio Online Store</h2>
          <p class="legal-doc__meta">Online store operating at <strong>https://domivio-official.com</strong></p>

          <div class="legal-doc__box">
            <strong>Key Highlights:</strong> Fast dispatch from our warehouse in Poland · <strong>Free shipping from 590.00 PLN</strong> · <strong>14-day withdrawal right</strong> for unused products in intact condition (subject to statutory hygiene exceptions under Art. 38(1)(5) of the Polish Consumer Rights Act).
          </div>

          <h3>§ 1. General Provisions & Contact Details</h3>
          <p>1. These Terms & Conditions govern the use of the <strong>Domivio</strong> online store available at <strong>https://domivio-official.com</strong>, electronic services, placing orders, delivery, payment methods, the statutory 14-day right of withdrawal, and complaint procedures under Polish law.</p>
          <p>2. Customer Support Contact: e-mail <strong>domivio.official@gmail.com</strong>, tel. <strong>+48 790 532 905</strong> (Monday – Saturday, 09:00–20:00 CET).</p>

          <h3>§ 2. Prices, Omnibus Directive & Conditional Bundle Discounts</h3>
          <p>1. All prices displayed in the Store are expressed in <strong>Polish Zloty (PLN)</strong> and include VAT (gross prices). Delivery costs are added at checkout according to the shipping schedule.</p>
          <p>2. In compliance with the EU <strong>Omnibus Directive</strong>, whenever a price reduction is announced, the lowest price applied during the 30 days prior to the reduction is displayed alongside the discounted price.</p>
          <p>3. Conditional bundle discounts apply in the product card and cart: <strong>2 pcs – 5% OFF</strong>, <strong>3 pcs – 10% OFF</strong>. In the event of a partial return where the number of retained items falls below the bundle discount threshold or below the 590.00 PLN free shipping threshold, the discount/free shipping is forfeited and the regular price difference and standard shipping fee (24.90 PLN / 29.90 PLN) are deducted from the refund.</p>

          <h3>§ 3. Right of Withdrawal (14 Days), Hygiene Exceptions & Diminished Value Liability</h3>
          <p>1. Pursuant to Article 27 of the Polish Consumer Rights Act of 30 May 2014, Consumers have the right to withdraw from a distance contract within <strong>14 calendar days</strong> of receiving the product, subject to paragraphs 2–4 below.</p>
          <p>2. <strong>Direct Return Shipping Cost & No COD Parcels (Art. 34(2)):</strong> The Consumer bears the direct cost of returning the product to the Seller's warehouse. Cash-on-delivery (COD) parcels and returns sent to parcel lockers are not accepted.</p>
          <p>3. <strong>Hygiene Exception (Art. 38(1)(5)) & Digital Content Exception (Art. 38(1)(13)):</strong> The right of withdrawal does not apply to goods delivered in a sealed hygiene/protective package which, once opened after delivery, cannot be returned due to health protection or hygiene reasons (such as sleeping pillows, baby pillows, and pillowcases in direct contact with skin and airways), nor to digital content (E-books).</p>
          <p>4. <strong>Consumer Liability for Diminished Value (Art. 34(4)):</strong> The Consumer is financially liable for any diminished value of the product resulting from handling it beyond what is necessary to establish its nature, characteristics, and functioning. If a returned product shows signs of actual use (sleeping, stains, odors, pet hair, washed cover, removed tags, or damaged packaging), the Seller is legally entitled to deduct the loss of commercial value (up to 100% if sanitary disposal is required) from the refund.</p>

          <h3>§ 4. Statutory Conformity Liability, No Commercial Warranty & B2B Exclusion</h3>
          <p>1. The Seller does not grant any additional commercial warranty within the meaning of Art. 577 of the Polish Civil Code. For Consumers, statutory liability for lack of conformity existing at delivery applies for 2 years (Chapter 5a of the Polish Consumer Rights Act), where repair or replacement takes statutory priority (Art. 43d). Mechanical damage, improper washing/drying, normal wear, and subjective firmness preferences are excluded.</p>
          <p>2. For B2B business purchases, statutory warranty (<em>rękojmia</em>) is completely excluded pursuant to <strong>Art. 558 § 1 of the Polish Civil Code</strong>, and no 14-day withdrawal right applies.</p>
        </div>
      `,
      prywatnosc: `
        <div class="legal-doc">
          <span class="legal-doc__badge">Compliant with EU GDPR (Regulation 2016/679)</span>
          <h2>Privacy & Cookies Policy (GDPR / RODO)</h2>
          <p class="legal-doc__meta">Personal data protection notice (Art. 13 & 14 GDPR) for customers of <strong>https://domivio-official.com</strong></p>

          <div class="legal-doc__box">
            Your personal data is protected by <strong>SSL/TLS encryption</strong> and processed solely to fulfill your order, deliver your parcel via InPost Paczkomat® / DPD, and comply with tax and legal obligations.
          </div>

          <h3>1. Data Controller</h3>
          <p>Your personal data is controlled by Domivio Polska (<strong>https://domivio-official.com</strong>). Contact for GDPR requests: <strong>domivio.official@gmail.com</strong>, tel. <strong>+48 790 532 905</strong> (Mon–Sat, 09:00–20:00 CET).</p>

          <h3>2. Purpose & Legal Basis of Processing (Art. 6 GDPR)</h3>
          <ul>
            <li><strong>Order fulfillment & contract performance (Art. 6(1)(b) GDPR):</strong> processing your order, generating InPost/DPD shipping labels, and delivering your parcel.</li>
            <li><strong>Legal & tax obligations (Art. 6(1)(c) GDPR):</strong> accounting records (stored for 5 tax years) and handling statutory consumer notices.</li>
            <li><strong>Legitimate interest (Art. 6(1)(f) GDPR):</strong> customer support, fraud prevention, and establishing, pursuing, or defending legal claims.</li>
          </ul>

          <h3>3. Data Recipients & Your Rights</h3>
          <p>Your data is shared only with trusted providers required to fulfill your order: <strong>Shopify International Ltd.</strong>, <strong>InPost Sp. z o.o.</strong>, <strong>DPD Polska Sp. z o.o.</strong>, and payment processors (BLIK, Przelewy24, Visa, Mastercard, Apple Pay, Google Pay). Under Articles 15–21 GDPR, you have the right to access, rectify, erase, restrict processing, port your data, object, and lodge a complaint with the Polish Data Protection Authority (<strong>PUODO</strong>, ul. Stawki 2, 00-193 Warsaw, <strong>https://uodo.gov.pl</strong>).</p>
        </div>
      `,
      zwroty: `
        <div class="legal-doc">
          <span class="legal-doc__badge">Pursuant to Art. 27–38 & Chapter 5a of the Polish Consumer Rights Act</span>
          <h2>Returns & Complaints (14-Day Withdrawal)</h2>
          <p class="legal-doc__meta">Consumer return rules, hygiene exceptions, and complaint procedure at <strong>Domivio (https://domivio-official.com)</strong></p>

          <div class="legal-doc__box">
            <strong>Important Hygiene Notice:</strong> Sleeping pillows and baby pillows come into direct contact with the face, head, and airways. Only <strong>brand-new, unused, clean, odor-free products in intact original packaging with tags</strong> qualify for a full 14-day return.
          </div>

          <h3>1. Conditions for 14-Day Withdrawal & Hygiene Rules</h3>
          <ul>
            <li><strong>Hygiene Exception (Art. 38(1)(5)):</strong> Products delivered in sealed hygiene/protective packaging cannot be returned if the protective packaging was unsealed after delivery.</li>
            <li><strong>Liability for Diminished Value (Art. 34(4)):</strong> Consumers are financially liable for any reduction in product value caused by using the product beyond brief inspection. If a returned item bears traces of sleeping, stains, odors, pet hair, or washing, the refund is reduced proportionally (up to 100% if sanitary disposal is required).</li>
            <li><strong>Return Shipping Cost (Art. 34(2)) & Inspection (Art. 32(3)):</strong> The Consumer covers the direct cost of return shipping. COD parcels and locker deliveries are not accepted. Refunds are processed within 14 days of receiving and inspecting the returned item at our warehouse in Poland.</li>
          </ul>

          <h3>2. Statutory Conformity Claims (Complaints)</h3>
          <p>No additional commercial warranty (Art. 577 Civil Code) is granted. Statutory conformity liability for Consumers applies for 2 years from delivery (Chapter 5a of the Polish Consumer Rights Act), with repair or replacement as the primary remedy (Art. 43d). Submit claims with photos and order number to <strong>domivio.official@gmail.com</strong> (resolved within 14 calendar days).</p>

          <h3>3. Model Withdrawal Form (Copy & Send by E-mail)</h3>
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Details to include in your e-mail to domivio.official@gmail.com</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Recipient</strong></td>
                <td>Domivio Customer Support – <strong>domivio.official@gmail.com</strong>, tel. +48 790 532 905</td>
              </tr>
              <tr>
                <td><strong>Statement</strong></td>
                <td>I hereby give notice that I withdraw from my contract of sale of the following goods: <em>[product name]</em> and confirm that the item is unused and in intact condition.</td>
              </tr>
              <tr>
                <td><strong>Order Number & Date</strong></td>
                <td>Order no. <em>[#...]</em> received on <em>[delivery date]</em></td>
              </tr>
              <tr>
                <td><strong>Consumer Details</strong></td>
                <td>Full name, e-mail address, phone number</td>
              </tr>
            </tbody>
          </table>
        </div>
      `,
      dostawa: `
        <div class="legal-doc">
          <span class="legal-doc__badge">Dispatch from Poland · Free Shipping from 590.00 PLN</span>
          <h2>Shipping & Payment Methods</h2>
          <p class="legal-doc__meta">Current shipping rates, delivery times, and payment methods at <strong>Domivio (https://domivio-official.com)</strong></p>

          <div class="legal-doc__box">
            All orders of <strong>590.00 PLN or more (after discounts) qualify for FREE SHIPPING (0.00 PLN)</strong> across Poland — via InPost Paczkomat® 24/7, DPD Pickup, or DPD Home Courier.
          </div>

          <h3>1. Dispatch & Delivery Time</h3>
          <p>Orders are dispatched from our <strong>warehouse in Poland within 24 business hours</strong> (up to 3 business days during peak promotional periods). Carrier transit time across Poland via InPost or DPD is <strong>1–2 business days</strong>.</p>

          <h3>2. Shipping Methods & Rates in Poland</h3>
          <table>
            <thead>
              <tr>
                <th>Delivery Method</th>
                <th>Estimated Transit Time</th>
                <th>Orders below 590.00 PLN</th>
                <th>Orders from 590.00 PLN</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>InPost Paczkomat® 24/7 Locker</strong> (interactive map in cart)</td>
                <td>1–2 business days</td>
                <td><strong>24.90 PLN</strong></td>
                <td><strong>0.00 PLN (FREE)</strong></td>
              </tr>
              <tr>
                <td><strong>DPD Paczkomat / Pickup Point</strong> (interactive map in cart)</td>
                <td>1–2 business days</td>
                <td><strong>24.90 PLN</strong></td>
                <td><strong>0.00 PLN (FREE)</strong></td>
              </tr>
              <tr>
                <td><strong>DPD Home Courier</strong> (door-to-door delivery)</td>
                <td>1–2 business days</td>
                <td><strong>29.90 PLN</strong></td>
                <td><strong>0.00 PLN (FREE)</strong></td>
              </tr>
            </tbody>
          </table>

          <h3>3. Secure Payment Methods</h3>
          <ul>
            <li><strong>BLIK</strong> – instant 6-digit mobile banking code payment.</li>
            <li><strong>Fast Online Bank Transfers (Przelewy24)</strong> – instant payment confirmation.</li>
            <li><strong>Payment Cards</strong> – Visa, Mastercard, Maestro.</li>
            <li><strong>Digital Wallets</strong> – Apple Pay and Google Pay.</li>
          </ul>
        </div>
      `,
    },
  };

  let currentLegalTab = "regulamin";

  window.openLegalModal = function (policyKey) {
    currentLegalTab = policyKey || "regulamin";
    const modal = document.getElementById("legalModal");
    const contentEl = document.getElementById("legalModalContent");
    if (!modal || !contentEl) return;

    const langPack = LEGAL_DOCS[currentLang] || LEGAL_DOCS.pl;
    const tabsHtml = langPack.tabs
      .map(
        (t) =>
          `<button type="button" class="legal-modal__tab ${
            t.key === currentLegalTab ? "is-active" : ""
          }" onclick="openLegalModal('${t.key}')">${t.label}</button>`
      )
      .join("");

    const docHtml = langPack[currentLegalTab] || langPack.regulamin;
    contentEl.innerHTML = `<div class="legal-modal__tabs">${tabsHtml}</div>${docHtml}`;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const dialog = modal.querySelector(".legal-modal__dialog");
    if (dialog) dialog.scrollTop = 0;
  };

  window.closeLegalModal = function () {
    const modal = document.getElementById("legalModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    const pdpModal = document.getElementById("pdpModal");
    if (!pdpModal || !pdpModal.classList.contains("is-open")) {
      document.body.style.overflow = "";
    }
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const legalModal = document.getElementById("legalModal");
      if (legalModal && legalModal.classList.contains("is-open")) {
        window.closeLegalModal();
      }
    }
  });

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
      .apaczkaMapWrapper { z-index: 2147483647 !important; font-family: 'Inter', -apple-system, sans-serif !important; }
      .apaczkaMapWrapper img { width: auto; height: auto; max-width: none; display: inline-block; }
      .apaczkaMapWrapper .apaczkaCellIcon { width: 64px !important; height: 40px !important; object-fit: contain !important; }
      .apaczkaMapWrapper .popupLogo img { width: 88px !important; height: auto !important; object-fit: contain !important; }
      .apaczkaMapFilterCod, .apaczkaMapWrapper .popupServices, .apaczkaMapWrapper .apaczkaMapFilter, .apaczkaMapWrapper .apaczkaMapLogo { display: none !important; }
      .apaczkaMapWrapper .apaczkaMapRow1 {
        display: flex !important; flex-wrap: wrap !important; align-items: center !important;
        justify-content: space-between !important; gap: 10px !important; padding: 12px 16px !important;
        background: #F6F3FF !important; border-bottom: 1.5px solid #EDE5FF !important;
        height: auto !important; min-height: 64px !important; box-sizing: border-box !important; overflow: visible !important;
      }
      .apaczkaMapWrapper .apaczkaMapMobileHide { overflow: visible !important; }
      .apaczkaMapWrapper .apaczkaMapSearch {
        position: relative !important; flex: 1 1 320px !important; width: auto !important;
        max-width: 520px !important; margin: 0 !important; float: none !important; overflow: visible !important;
      }
      .apaczkaMapWrapper .apaczkaMapSearch input[name="search"] {
        width: 100% !important; height: 42px !important; padding: 0 64px 0 14px !important;
        border: 1.5px solid #7B42F6 !important; border-radius: 4px !important;
        font-size: 13.5px !important; font-weight: 500 !important; color: #242C34 !important;
        background: #FFFFFF !important; box-sizing: border-box !important; outline: none !important;
      }
      .dom-map-header-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .dom-map-carrier-tab {
        appearance: none; border: 1.5px solid #D8B4FE; background: #FFFFFF; color: #242C34;
        padding: 9px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase;
        cursor: pointer; border-radius: 4px; line-height: 1; transition: all 0.15s;
      }
      .dom-map-carrier-tab:hover { background: #F6F3FF; border-color: #7B42F6; color: #7B42F6; }
      .dom-map-carrier-tab.is-active { background: #7B42F6 !important; color: #FFFFFF !important; border-color: #7B42F6 !important; box-shadow: 0 4px 12px rgba(123,66,246,0.22); }
      .dom-map-close-desktop {
        appearance: none; border: 1.5px solid #242C34; background: #242C34; color: #FFFFFF;
        padding: 9px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase;
        cursor: pointer; border-radius: 4px; line-height: 1;
      }
      .dom-map-autocomplete {
        position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #FFFFFF;
        border: 1.5px solid #7B42F6; border-radius: 4px; box-shadow: 0 12px 32px rgba(123,66,246,0.18);
        z-index: 2147483647; max-height: 360px; overflow-y: auto; display: none; text-align: left;
      }
      .dom-map-autocomplete.is-open { display: block; }
      .dom-map-ac-section {
        padding: 7px 12px; background: #F6F3FF; border-bottom: 1px solid #EDE5FF;
        font-size: 10px; font-weight: 800; text-transform: uppercase; color: #7B42F6; letter-spacing: 0.04em;
      }
      .dom-map-ac-item {
        padding: 9px 12px; border-bottom: 1px solid #F1F5F9; cursor: pointer;
        display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #FFFFFF;
      }
      .dom-map-ac-item:hover { background: #F6F3FF; }
      .dom-map-ac-main { font-size: 12.5px; font-weight: 700; color: #242C34; }
      .dom-map-ac-sub { font-size: 11px; color: #64748B; }
      .dom-map-ac-pick-btn {
        background: #7B42F6; color: #FFFFFF; border: none; border-radius: 4px;
        padding: 5px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; cursor: pointer;
      }
      .apaczkaMapWrapper .popupButtons a,
      .apaczkaMapWrapper .apaczkaMapSelectPoint {
        background: #7B42F6 !important; color: #FFFFFF !important; border: none !important;
        border-radius: 4px !important; font-weight: 700 !important; text-transform: uppercase !important;
      }
      .apaczkaMapWrapper .apaczkaTableRow:hover { background: #F6F3FF !important; }
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
        c === "INPOST" ? "InPost Paczkomat" : c === "DPD" ? "DPD Paczkomat" : "Wszystkie";
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
        <button type="button" class="dom-map-carrier-tab" data-dom-carrier-tab="INPOST">InPost Paczkomat</button>
        <button type="button" class="dom-map-carrier-tab" data-dom-carrier-tab="DPD">DPD Paczkomat</button>
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

  // ── Live Sync with Shopify Backend (1tvnzn-zf.myshopify.com) ──────────
  async function syncWithShopifyBackend() {
    try {
      const colHandles = ["frontpage", "hity-sprzedazy", "poduszki", "koldra", "koldry", "dla-dzieci", "akcesoria", "zestawy", "na-prezent"];
      const catColHandles = ["poduszki", "koldra", "koldry", "dla-dzieci", "akcesoria", "zestawy", "na-prezent"];
      const normalizeCatHandle = (h) => {
        if (h === "na-prezent") return "zestawy";
        if (h === "koldry" || h === "kołdra" || h === "kołdry") return "koldra";
        return h;
      };
      const [prodResp, ...colResps] = await Promise.allSettled([
        fetch(`/products.json?limit=250`).then((r) => (r.ok ? r.json() : null)),
        ...colHandles.map((h) =>
          fetch(`/collections/${h}/products.json?limit=250`).then((r) => (r.ok ? r.json() : null))
        )
      ]);

      if (prodResp.status !== "fulfilled" || !prodResp.value) return;
      const remoteProducts = prodResp.value.products || [];
      if (!remoteProducts.length) return;

      // Map product ID -> array of collection handles from Shopify Admin "Kolekcje"
      // Also record exact product order inside each collection for drag-and-drop sorting
      const prodColMap = {};
      const nextColOrderMap = {};
      const addColMapping = (pid, handle) => {
        const key = String(pid);
        const normHandle = normalizeCatHandle(handle);
        if (!prodColMap[key]) prodColMap[key] = [];
        if (!prodColMap[key].includes(normHandle)) prodColMap[key].push(normHandle);
      };

      if (window.DOMIVIO_COLLECTION_MAP) {
        Object.keys(window.DOMIVIO_COLLECTION_MAP).forEach((h) => {
          const normH = normalizeCatHandle(h);
          const ids = (window.DOMIVIO_COLLECTION_MAP[h] || []).map((id) => String(id));
          if (ids.length > 0 && !nextColOrderMap[normH]) {
            nextColOrderMap[normH] = ids.slice();
          }
          ids.forEach((pid) => addColMapping(pid, h));
        });
      }

      colHandles.forEach((h, idx) => {
        const cRes = colResps[idx];
        if (cRes && cRes.status === "fulfilled" && cRes.value && Array.isArray(cRes.value.products)) {
          const normH = normalizeCatHandle(h);
          if (cRes.value.products.length > 0) {
            nextColOrderMap[normH] = cRes.value.products.map((cp) => String(cp.id));
          }
          cRes.value.products.forEach((cp) => addColMapping(cp.id, h));
        }
      });
      collectionOrderMap = nextColOrderMap;

      const stripHtml = (html) => {
        if (!html) return "";
        const formatted = String(html)
          .replace(/<\s*br\s*\/?>/gi, "\n")
          .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
          .replace(/<\s*li[^>]*>/gi, "• ");
        const tmp = document.createElement("div");
        tmp.innerHTML = formatted;
        return (tmp.textContent || tmp.innerText || "")
          .replace(/\r\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      };

      const parseProductTabs = (rawHtml, pid) => {
        const fullText = stripHtml(rawHtml);
        const sections = { opis: "", charakterystyka: "", detale: "", hasCustomOpis: false };
        const matches = [...fullText.matchAll(/(?:^|\n)[ \t]*(OPIS|CHARAKTERYSTYKA|DETALE)[ \t]*(?::[ \t]*\n?|\n)/gi)];
        if (matches.length > 0) {
          sections.hasCustomOpis = true;
          const firstIdx = matches[0].index || 0;
          const beforeFirst = fullText.slice(0, firstIdx).trim();
          for (let i = 0; i < matches.length; i++) {
            const key = matches[i][1].toLowerCase();
            const start = (matches[i].index || 0) + matches[i][0].length;
            const end = i + 1 < matches.length ? (matches[i + 1].index || fullText.length) : fullText.length;
            sections[key] = fullText.slice(start, end).trim();
          }
          if (!sections.opis && beforeFirst) {
            sections.opis = beforeFirst;
          }
        } else {
          sections.opis = fullText;
          if (fullText) sections.hasCustomOpis = true;
        }

        const metaMap = window.DOMIVIO_METAFIELDS_MAP || {};
        const meta = metaMap[String(pid)] || {};
        if (meta.opis) {
          sections.opis = String(meta.opis).trim();
          sections.hasCustomOpis = true;
        }
        if (meta.charakterystyka) {
          sections.charakterystyka = String(meta.charakterystyka).trim();
        }
        if (meta.detale) {
          sections.detale = String(meta.detale).trim();
        }
        return sections;
      };

      const dedupeShopifyImages = (imgArray) => {
        const seen = new Set();
        const result = [];
        (imgArray || []).forEach((im) => {
          const src = typeof im === "string" ? im : im && im.src;
          if (!src) return;
          const filePart = src.split("?")[0].split("/").pop() || src;
          const cleanKey = filePart.replace(
            /_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\.[a-z0-9]+$)/i,
            ""
          );
          if (!seen.has(cleanKey)) {
            seen.add(cleanKey);
            result.push(src);
          }
        });
        return result;
      };

      const catLabelPLMap = {
        "poduszki": "PODUSZKI",
        "koldra": "KOŁDRA",
        "dla-dzieci": "DLA DZIECI",
        "akcesoria": "AKCESORIA",
        "zestawy": "ZESTAWY"
      };
      const catLabelENMap = {
        "poduszki": "PILLOWS",
        "koldra": "DUVETS",
        "dla-dzieci": "FOR KIDS",
        "akcesoria": "ACCESSORIES",
        "zestawy": "SETS"
      };

      const syncedList = [];

      remoteProducts.forEach((rp) => {
        if (!rp.variants || !rp.variants.length) return;
        const rv = rp.variants[0];
        const livePrice = parseFloat(rv.price) || 369.0;
        const liveComp = parseFloat(rv.compare_at_price) || 0;
        const rpImgs = dedupeShopifyImages(rp.images);
        const parsedTabs = parseProductTabs(rp.body_html, rp.id);
        const bodyText = parsedTabs.opis;

        const existing = PRODUCTS.find(
          (p) => p.id === rp.id || p.handle === rp.handle
        );

        const cats = [];
        const addCat = (c) => {
          const norm = normalizeCatHandle(c);
          if (norm && !cats.includes(norm)) cats.push(norm);
        };

        // 1. Categories from Shopify Admin "Kolekcje"
        (prodColMap[String(rp.id)] || []).forEach((h) => {
          if (catColHandles.includes(h) || h === "koldra" || h === "zestawy") addCat(h);
        });

        // 2. Categories from Shopify Admin "Typ" (product_type) and "Tagi" (tags)
        const rawTagsList = Array.isArray(rp.tags)
          ? rp.tags.map((t) => String(t).trim())
          : String(rp.tags || "")
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);

        let sortTagOrder = null;
        for (const tg of rawTagsList) {
          const m = tg.match(/^(?:poz(?:ycja)?[-_:\s]*|nr[-_:\s]*|order[-_:\s]*|kolejnosc[-_:\s]*)?(\d{1,3})$/i);
          if (m) {
            sortTagOrder = parseInt(m[1], 10);
            break;
          }
        }

        const tagStr = [rp.product_type || "", rawTagsList.join(" ")]
          .join(" ")
          .toLowerCase();
        const titleLower = String(rp.title || "").toLowerCase();

        if (tagStr.includes("kołdr") || tagStr.includes("koldr") || tagStr.includes("duvet")) addCat("koldra");
        if (tagStr.includes("poduszk") || tagStr.includes("pillow")) addCat("poduszki");
        if (tagStr.includes("dziec") || tagStr.includes("kid")) addCat("dla-dzieci");
        if (tagStr.includes("akcesor") || tagStr.includes("poszewk") || tagStr.includes("access")) addCat("akcesoria");
        if (tagStr.includes("zestaw") || tagStr.includes("prezent") || tagStr.includes("set") || tagStr.includes("bundle")) addCat("zestawy");

        // If a product belongs to both "koldra" and "dla-dzieci", keep "koldra" as its primary card label unless product_type says "dla dzieci"
        if (cats.includes("koldra") && cats[0] === "dla-dzieci" && !String(rp.product_type || "").toLowerCase().includes("dziec")) {
          const kIdx = cats.indexOf("koldra");
          if (kIdx !== -1) cats.splice(kIdx, 1);
          cats.unshift("koldra");
        }

        // 3. Fallback if no category was assigned yet in Shopify Admin ("Kolekcje" / "Typ" / "Tagi")
        if (cats.length === 0) {
          if (titleLower.includes("kołdr") || titleLower.includes("koldr") || titleLower.includes("duvet")) addCat("koldra");
          if (titleLower.includes("dzieci") || titleLower.includes("niemowl")) addCat("dla-dzieci");
          if (cats.length === 0 && existing && Array.isArray(existing.category) && existing.category.length > 0) {
            existing.category.forEach(addCat);
          }
          if (cats.length === 0) {
            addCat("poduszki");
          }
        }

        const primaryCat = cats[0] || "poduszki";

        syncedList.push({
          id: rp.id,
          variantId: rv.id,
          shopifyVariantId: rv.id,
          handle: rp.handle,
          category: cats,
          sortTagOrder: sortTagOrder,
          catLabelPL: catLabelPLMap[primaryCat] || (rp.product_type || "PODUSZKI").toUpperCase(),
          catLabelEN: catLabelENMap[primaryCat] || (rp.product_type || "PILLOWS").toUpperCase(),
          isMysteryBox: existing ? existing.isMysteryBox : syncedList.length === 0,
          badges: [],
          specTopPL: "",
          specTopEN: "",
          specHeightPL: (existing && existing.specHeightPL) || "Wysokość — 8,5/10 cm",
          specHeightEN: (existing && existing.specHeightEN) || "Height — 8.5/10 cm",
          specFirmPL: (existing && existing.specFirmPL) || "Twardość — średnia",
          specFirmEN: (existing && existing.specFirmEN) || "Firmness — medium",
          pricePLN: livePrice,
          comparePLN: liveComp > livePrice ? liveComp : 0,
          priceEUR: Number((livePrice / 4.25).toFixed(2)),
          compareEUR: liveComp > livePrice ? Number((liveComp / 4.25).toFixed(2)) : 0,
          rating: "4.9",
          reviewsCount: 149,
          sizes: [],
          images: rpImgs.length > 0 ? rpImgs : existing && existing.images ? existing.images : [resolveAsset("domivio_wave_1.jpg")],
          title: {
            pl: rp.title,
            en: rp.title
          },
          shortDesc: {
            pl: bodyText || (existing && existing.shortDesc && existing.shortDesc.pl) || "Innowacyjny produkt do snu nowej generacji z technologią komórkową TPE CELL®.",
            en: bodyText || (existing && existing.shortDesc && existing.shortDesc.en) || "Innovative next-generation sleep product with cellular TPE CELL® technology."
          },
          hasCustomOpis: parsedTabs.hasCustomOpis,
          opisText: {
            pl: bodyText || (existing && existing.shortDesc && existing.shortDesc.pl) || "",
            en: bodyText || (existing && existing.shortDesc && existing.shortDesc.en) || ""
          },
          charakterystykaText: {
            pl: parsedTabs.charakterystyka || "",
            en: parsedTabs.charakterystyka || ""
          },
          detaleText: {
            pl: parsedTabs.detale || "",
            en: parsedTabs.detale || ""
          },
          bullets: (existing && existing.bullets) || {
            pl: [
              "💜 Opatentowana technologia TPE CELL®",
              "❄️ Termoregulacja 360° przez całą noc",
              "🚚 Darmowa dostawa od 590 zł"
            ],
            en: [
              "💜 Patented TPE CELL® technology",
              "❄️ 360° airflow all night",
              "🚚 Free shipping from 590 PLN"
            ]
          }
        });
      });

      if (syncedList.length > 0) {
        const homeOrder =
          (collectionOrderMap["hity-sprzedazy"] && collectionOrderMap["hity-sprzedazy"].length > 0
            ? collectionOrderMap["hity-sprzedazy"]
            : collectionOrderMap["frontpage"]) || [];

        syncedList.sort((a, b) => {
          const tagA = typeof a.sortTagOrder === "number" ? a.sortTagOrder : 999999;
          const tagB = typeof b.sortTagOrder === "number" ? b.sortTagOrder : 999999;
          if (tagA !== tagB) return tagA - tagB;
          if (homeOrder.length > 0) {
            const idxA = homeOrder.indexOf(String(a.id));
            const idxB = homeOrder.indexOf(String(b.id));
            const posA = idxA !== -1 ? idxA : 999999;
            const posB = idxB !== -1 ? idxB : 999999;
            if (posA !== posB) return posA - posB;
          }
          return 0;
        });

        PRODUCTS.length = 0;
        syncedList.forEach((item) => PRODUCTS.push(item));
        renderHeroPrice();
        renderCatalog();
        renderCartUI();
      }
    } catch (e) {
      // Fallback to bundled catalog if offline
    }
  }

  // ── Init on DOMContentLoaded & Shopify Theme Editor Live Reload ───────
  function initDomivioStorefront() {
    window.setDomivioLang(currentLang);
    syncWithShopifyBackend();

    document.querySelectorAll(".dw-logo").forEach((logoEl) => {
      logoEl.onclick = (e) => window.resetToHome(e);
    });

    document.querySelectorAll(".dw-hero__btn").forEach((btnEl) => {
      btnEl.addEventListener("click", () => {
        window.filterCatalog("all");
      });
    });

    document.querySelectorAll(".dw-avatar").forEach((el, idx) => {
      el.style.cursor = "pointer";
      el.onclick = () => window.switchDarwinStory(idx);
    });
    document.querySelectorAll(".dw-reviews__nums span").forEach((el, idx) => {
      el.style.cursor = "pointer";
      el.onclick = () => window.switchDarwinStory(idx);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initDomivioStorefront();

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

  document.addEventListener("shopify:section:load", () => {
    initDomivioStorefront();
  });
})();
