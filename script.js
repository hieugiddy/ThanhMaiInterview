(() => {
  "use strict";

  const STORAGE = {
    theme: "interviewHub.theme",
    learned: "interviewHub.learned",
    hideLearned: "interviewHub.hideLearned"
  };

  const CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const html = document.documentElement;
  const body = document.body;
  const qaElements = $$(".qa");
  const sections = $$(".section[data-section]");
  const tocLinks = $$(".toc-link");
  const searchInput = $("#searchInput");
  const clearSearch = $("#clearSearch");
  const clearSearch2 = $("#clearSearch2");
  const searchStatus = $("#searchStatus");
  const searchText = $("#searchText");
  const hideLearnedInput = $("#hideLearned");
  const learnedPercent = $("#learnedPercent");
  const learnedBar = $("#learnedBar");
  const learnedCount = $("#learnedCount");
  const qaTotal = $("#qaTotal");
  const learnedProgress = $("#learnedProgress");
  const statQuestions = $("#statQuestions");
  const themeBtn = $("#themeBtn");
  const menuBtn = $("#menuBtn");
  const sidebar = $("#sidebar");
  const sidebarOverlay = $("#sidebarOverlay");
  const progressBar = $("#progressBar");
  const backTop = $("#backTop");
  const toast = $("#toast");
  const randomBtn = $("#randomBtn");
  const resetBtn = $("#resetBtn");
  const printBtn = $("#printBtn");
  const copyIntro = $("#copyIntro");

  let learned = loadLearned();
  let toastTimer = 0;
  let searchTimer = 0;
  let printOpenState = null;
  let refreshActiveToc = null;

  const normalize = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const searchIndex = new Map();
  const sectionTitleIndex = new Map();
  const sectionExtraIndex = new Map();

  function safeStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage can be unavailable in private mode */
    }
  }

  function safeStorageRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  function loadLearned() {
    try {
      const raw = safeStorageGet(STORAGE.learned);
      const data = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(data) ? data.filter((id) => typeof id === "string") : []);
    } catch {
      return new Set();
    }
  }

  function persistLearned() {
    safeStorageSet(STORAGE.learned, JSON.stringify([...learned]));
  }

  function showToast(message, duration = 2300) {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), duration);
  }

  function applyTheme(theme, persist = false) {
    html.dataset.theme = theme;
    const isDark = theme === "dark";
    themeBtn?.setAttribute("aria-label", isDark ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối");
    themeBtn?.setAttribute("aria-pressed", String(isDark));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isDark ? "#0a0f1d" : "#4f46e5");
    if (persist) safeStorageSet(STORAGE.theme, theme);
  }

  function initTheme() {
    const stored = safeStorageGet(STORAGE.theme);
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    applyTheme(stored === "dark" || stored === "light" ? stored : prefersDark ? "dark" : "light");
    themeBtn?.addEventListener("click", () => {
      applyTheme(html.dataset.theme === "dark" ? "light" : "dark", true);
    });
  }

  function injectLearnButtons() {
    qaElements.forEach((qa) => {
      const summary = qa.querySelector("summary");
      if (!summary || summary.querySelector(".learn-toggle")) return;

      const id = qa.id || `qa-${Math.random().toString(36).slice(2, 9)}`;
      qa.id = id;
      qa.dataset.qaId = id;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "learn-toggle";
      button.innerHTML = CHECK_SVG;
      button.dataset.learnId = id;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleLearned(id);
      });

      const chevron = summary.querySelector(".chevron");
      if (chevron) summary.insertBefore(button, chevron);
      else summary.appendChild(button);

      syncLearnButton(id);
    });
  }

  function syncLearnButton(id) {
    const button = document.querySelector(`.learn-toggle[data-learn-id="${CSS.escape(id)}"]`);
    if (!button) return;
    const isLearned = learned.has(id);
    button.setAttribute("aria-pressed", String(isLearned));
    button.setAttribute("aria-label", isLearned ? "Bỏ đánh dấu đã học" : "Đánh dấu đã học");
    button.title = isLearned ? "Bỏ đánh dấu đã học" : "Đánh dấu đã học";
  }

  function toggleLearned(id) {
    if (learned.has(id)) {
      learned.delete(id);
      showToast("Đã bỏ đánh dấu câu hỏi");
    } else {
      learned.add(id);
      showToast("Đã đánh dấu là đã học");
    }
    persistLearned();
    syncLearnButton(id);
    updateProgress();
    if (hideLearnedInput?.checked) applyFilters();
  }

  function updateProgress() {
    const total = qaElements.length;
    let done = 0;
    qaElements.forEach((qa) => {
      const isLearned = learned.has(qa.id);
      qa.classList.toggle("learned", isLearned);
      if (isLearned) done += 1;
    });

    const percent = total ? Math.round((done / total) * 100) : 0;
    if (learnedPercent) learnedPercent.textContent = `${percent}%`;
    if (learnedBar) learnedBar.style.width = `${percent}%`;
    if (learnedCount) learnedCount.textContent = String(done);
    if (qaTotal) qaTotal.textContent = String(total);
    if (statQuestions) statQuestions.textContent = String(total);
    learnedProgress?.setAttribute("aria-valuenow", String(percent));

    sections.forEach(updateSectionToggle);
  }

  function updateSectionToggle(section) {
    const button = document.querySelector(`[data-toggle-section="${CSS.escape(section.id)}"]`);
    if (!button) return;
    const visibleQas = $$(".qa:not(.is-hidden)", section);
    const allOpen = visibleQas.length > 0 && visibleQas.every((qa) => qa.open);
    button.textContent = allOpen ? "Đóng tất cả" : "Mở tất cả";
  }

  function buildSearchIndex() {
    qaElements.forEach((qa) => {
      const text = [
        qa.querySelector(".q-text")?.textContent,
        qa.querySelector(".q-tag")?.textContent,
        qa.querySelector(".answer")?.textContent
      ]
        .filter(Boolean)
        .join(" ");
      searchIndex.set(qa, normalize(text));
    });

    sections.forEach((section) => {
      const head = section.querySelector(".section-head");
      const titleText = head
        ? [
            head.querySelector(".section-kicker")?.textContent,
            head.querySelector("h2")?.textContent
          ]
            .filter(Boolean)
            .join(" ")
        : "";
      sectionTitleIndex.set(section, normalize(titleText));

      const extraText = Array.from(section.children)
        .filter((child) => !child.classList.contains("qa-list"))
        .map((child) => {
          const clone = child.cloneNode(true);
          clone
            .querySelectorAll(".section-kicker, h2, .section-actions")
            .forEach((element) => element.remove());
          return clone.textContent;
        })
        .join(" ");
      sectionExtraIndex.set(section, normalize(extraText));
    });
  }

  function applyFilters() {
    const query = searchInput?.value || "";
    const normalizedQuery = normalize(query);
    const terms = normalizedQuery ? normalizedQuery.split(" ").filter(Boolean) : [];
    const hideLearned = Boolean(hideLearnedInput?.checked);
    const hasQuery = terms.length > 0;
    let visibleQas = 0;
    let hiddenLearned = 0;
    let contentOnlySections = 0;

    sections.forEach((section) => {
      const titleMatches =
        hasQuery && terms.every((term) => (sectionTitleIndex.get(section) || "").includes(term));
      const extraMatches =
        hasQuery && terms.every((term) => (sectionExtraIndex.get(section) || "").includes(term));
      const sectionQas = $$(".qa", section);
      let sectionVisibleQas = 0;

      sectionQas.forEach((qa) => {
        const qaMatches = hasQuery && terms.every((term) => (searchIndex.get(qa) || "").includes(term));
        let visible = !hasQuery || titleMatches || qaMatches;

        if (hideLearned && learned.has(qa.id)) {
          if (visible) hiddenLearned += 1;
          visible = false;
        }

        qa.classList.toggle("is-hidden", !visible);
        if (visible) {
          sectionVisibleQas += 1;
          visibleQas += 1;
        }
      });

      const hasQas = sectionQas.length > 0;
      let sectionVisible = true;

      if (hasQuery) {
        sectionVisible = titleMatches || extraMatches || sectionVisibleQas > 0;
      } else if (hideLearned && hasQas) {
        sectionVisible = sectionVisibleQas > 0;
      }

      if (hasQuery && sectionVisible && sectionVisibleQas === 0) contentOnlySections += 1;

      section.classList.toggle("is-hidden", !sectionVisible);
      updateSectionToggle(section);
    });

    if (searchStatus) {
      if (hasQuery) {
        searchStatus.hidden = false;
        if (searchText) {
          if (visibleQas > 0) {
            searchText.textContent = `Tìm thấy ${visibleQas} câu hỏi cho “${query.trim()}”. Nhấn vào câu hỏi để xem đáp án.`;
          } else if (contentOnlySections > 0) {
            searchText.textContent = `Không có câu hỏi khớp “${query.trim()}”, nhưng phần nội dung liên quan vẫn được hiển thị bên dưới.`;
          } else {
            searchText.textContent = `Không tìm thấy câu hỏi phù hợp cho “${query.trim()}”.`;
          }
        }
      } else if (hideLearned && hiddenLearned > 0) {
        searchStatus.hidden = false;
        if (searchText) {
          searchText.textContent = `Đang ẩn ${hiddenLearned} câu đã đánh dấu. Bỏ chọn “Chỉ hiện câu chưa học” để xem lại.`;
        }
      } else {
        searchStatus.hidden = true;
      }
    }

    if (clearSearch) clearSearch.hidden = !hasQuery;
    refreshActiveToc?.();
  }

  function clearSearchInput() {
    if (!searchInput) return;
    searchInput.value = "";
    applyFilters();
    searchInput.focus({ preventScroll: true });
  }

  function clearAllFilters() {
    if (searchInput) searchInput.value = "";
    if (hideLearnedInput) {
      hideLearnedInput.checked = false;
      safeStorageSet(STORAGE.hideLearned, "false");
    }
    applyFilters();
  }

  function initSearch() {
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(applyFilters, 110);
    });

    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        clearSearchInput();
      }
    });

    clearSearch?.addEventListener("click", clearSearchInput);
    clearSearch2?.addEventListener("click", clearAllFilters);

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
      }

      if (event.key === "Escape") {
        if (sidebar?.classList.contains("open")) closeSidebar();
        else if (document.activeElement === searchInput && searchInput.value) clearSearchInput();
      }
    });
  }

  function initLearnFilter() {
    if (!hideLearnedInput) return;
    hideLearnedInput.checked = safeStorageGet(STORAGE.hideLearned) === "true";
    hideLearnedInput.addEventListener("change", () => {
      safeStorageSet(STORAGE.hideLearned, String(hideLearnedInput.checked));
      applyFilters();
    });
  }

  function initSectionToggles() {
    $$("[data-toggle-section]").forEach((button) => {
      button.addEventListener("click", () => {
        const section = document.getElementById(button.dataset.toggleSection);
        if (!section) return;
        const qas = $$(".qa:not(.is-hidden)", section);
        if (!qas.length) return;
        const allOpen = qas.every((qa) => qa.open);
        qas.forEach((qa) => {
          qa.open = !allOpen;
        });
        button.textContent = allOpen ? "Mở tất cả" : "Đóng tất cả";
      });
    });

    qaElements.forEach((qa) => {
      qa.addEventListener("toggle", () => {
        const section = qa.closest(".section");
        if (section) updateSectionToggle(section);
      });
    });
  }

  function initScrollUI() {
    if (!progressBar && !backTop) return;
    let ticking = false;

    const update = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
      if (progressBar) progressBar.style.width = `${progress}%`;
      backTop?.classList.toggle("visible", scrollTop > 700);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  function initActiveToc() {
    if (!tocLinks.length) return null;
    const targets = tocLinks
      .map((link) => {
        const id = link.getAttribute("href")?.slice(1);
        const element = id ? document.getElementById(id) : null;
        return element ? { link, element } : null;
      })
      .filter(Boolean);

    let ticking = false;

    const update = () => {
      const offset = 140;
      const usable = targets.filter(({ element }) => !element.classList.contains("is-hidden"));
      let active = null;
      usable.forEach(({ link, element }) => {
        if (element.getBoundingClientRect().top <= offset) active = link;
      });

      if (!active) {
        const nearTop = window.scrollY < 180;
        if (!nearTop) active = usable[0]?.link || null;
      }

      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) active = usable[usable.length - 1]?.link || active;

      targets.forEach(({ link }) => link.classList.toggle("active", link === active));
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return update;
  }

  function openSidebar() {
    if (!sidebar || !menuBtn) return;
    sidebar.classList.add("open");
    if (sidebarOverlay) sidebarOverlay.hidden = false;
    menuBtn.setAttribute("aria-expanded", "true");
    body.classList.add("no-scroll");
  }

  function closeSidebar() {
    if (!sidebar || !menuBtn) return;
    sidebar.classList.remove("open");
    if (sidebarOverlay) sidebarOverlay.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
    body.classList.remove("no-scroll");
  }

  function initSidebar() {
    if (!sidebar || !menuBtn) return;
    menuBtn.addEventListener("click", () => {
      if (sidebar.classList.contains("open")) closeSidebar();
      else openSidebar();
    });

    sidebarOverlay?.addEventListener("click", closeSidebar);

    $$(".toc-link", sidebar).forEach((link) => {
      link.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 1080px)").matches) closeSidebar();
      });
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 1080 && sidebar.classList.contains("open")) closeSidebar();
    });
  }

  function initInternalLinks() {
    document.addEventListener("click", (event) => {
      const anchor = event.target.closest?.('a[href^="#"]');
      if (!anchor) return;
      const hash = anchor.getAttribute("href");
      if (!hash || hash === "#" || hash === "#home") return;
      const target = document.querySelector(hash);
      if (!target) return;

      if (target.classList.contains("is-hidden")) {
        clearAllFilters();
      }

      if (target.classList.contains("qa")) {
        target.open = true;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  function initBackTop() {
    backTop?.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  async function copyIntroText() {
    const source = $("#introSource");
    const text = source?.textContent?.trim();
    if (!text) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      showToast("Đã sao chép bản giới thiệu");
    } catch {
      showToast("Không thể sao chép. Hãy chọn văn bản và copy thủ công.");
    }
  }

  function initCopyIntro() {
    copyIntro?.addEventListener("click", copyIntroText);
  }

  function initRandomQuestion() {
    if (!randomBtn) return;
    randomBtn.addEventListener("click", () => {
      if (searchInput?.value || hideLearnedInput?.checked) clearAllFilters();

      const pool = qaElements.filter((qa) => !qa.classList.contains("is-hidden"));
      if (!pool.length) {
        showToast("Không có câu hỏi để chọn");
        return;
      }

      const qa = pool[Math.floor(Math.random() * pool.length)];
      qa.open = true;
      qa.classList.remove("flash");
      void qa.offsetWidth;
      qa.classList.add("flash");
      qa.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => qa.classList.remove("flash"), 1600);

      const question = qa.querySelector(".q-text")?.textContent?.trim();
      showToast(question ? `Ôn câu: ${question}` : "Đã chọn một câu hỏi ngẫu nhiên", 3200);
    });
  }

  function initReset() {
    if (!resetBtn) return;
    resetBtn.addEventListener("click", () => {
      if (!learned.size) {
        showToast("Chưa có câu nào được đánh dấu");
        return;
      }
      if (!window.confirm(`Đặt lại tiến độ? ${learned.size} câu đã đánh dấu sẽ bị xóa.`)) return;

      learned.clear();
      safeStorageRemove(STORAGE.learned);
      if (hideLearnedInput) {
        hideLearnedInput.checked = false;
        safeStorageSet(STORAGE.hideLearned, "false");
      }
      qaElements.forEach((qa) => syncLearnButton(qa.id));
      updateProgress();
      applyFilters();
      showToast("Đã đặt lại tiến độ ôn tập");
    });
  }

  function initPrint() {
    printBtn?.addEventListener("click", () => window.print());

    window.addEventListener("beforeprint", () => {
      printOpenState = qaElements.map((qa) => qa.open);
      qaElements.forEach((qa) => {
        qa.open = true;
      });
    });

    window.addEventListener("afterprint", () => {
      if (!printOpenState) return;
      qaElements.forEach((qa, index) => {
        qa.open = Boolean(printOpenState[index]);
      });
      printOpenState = null;
    });
  }

  function initSearchFocusOnLoad() {
    const hash = window.location.hash;
    if (!hash || hash === "#") return;
    try {
      const target = document.querySelector(hash);
      if (target?.classList.contains("qa")) target.open = true;
    } catch {
      /* invalid hash selector */
    }
  }

  function pruneLearned() {
    const existing = new Set(qaElements.map((qa) => qa.id));
    const next = new Set([...learned].filter((id) => existing.has(id)));
    if (next.size !== learned.size) {
      learned = next;
      persistLearned();
    }
  }

  function init() {
    initTheme();
    injectLearnButtons();
    pruneLearned();
    buildSearchIndex();
    initLearnFilter();
    initSearch();
    initSectionToggles();
    initScrollUI();
    refreshActiveToc = initActiveToc() || null;
    initSidebar();
    initInternalLinks();
    initBackTop();
    initCopyIntro();
    initRandomQuestion();
    initReset();
    initPrint();
    initSearchFocusOnLoad();

    updateProgress();
    applyFilters();
  }

  init();
})();
