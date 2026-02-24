const state = {
    pageNumber: 0,
    pageSize: 3,
    count: 0,
    pages: 1,
    editingId: null,
    isRefreshing: false
};

const RACES = ["HUMAN","DWARF","ELF","GIANT","ORC","TROLL","HOBBIT"];
const PROFESSIONS = ["WARRIOR","ROGUE","SORCERER","CLERIC","PALADIN","NAZGUL","DRUID"];

function showToast(text, kind) {
    const t = document.getElementById("toast");
    t.classList.remove("hidden", "ok", "err");
    t.classList.add(kind === "ok" ? "ok" : "err");
    t.textContent = text;

    setTimeout(() => {
        t.classList.add("hidden");
    }, 2200);
}

function setCreateError(text) {
    document.getElementById("createError").textContent = text || "";
}

function setLoading(v) {
    state.isRefreshing = v;
    document.body.classList.toggle("loading", v);
    document.getElementById("pageSize").disabled = v;
    document.getElementById("createBtn").disabled = v;
    document.getElementById("pagination").classList.toggle("disabled", v);
}

function formatDate(ms) {
    const d = new Date(ms);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
}

function parseDateInputToMs(dateStr) {
    const parts = String(dateStr).split("-");
    if (parts.length !== 3) return NaN;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return NaN;
    return Date.UTC(y, m - 1, d);
}

function optionsHtml(arr, selected) {
    return arr.map(v => `<option value="${v}" ${v === selected ? "selected" : ""}>${v}</option>`).join("");
}

function escapeAttr(s) {
    return String(s).replaceAll('"', '&quot;');
}

function validateNameTitle(name, title) {
    if (name.length < 1 || name.length > 12) return "Name должен быть 1..12 символов";
    if (title.length < 1 || title.length > 30) return "Title должен быть 1..30 символов";
    return null;
}

async function fetchCount() {
    const res = await fetch("/rest/players/count");
    if (!res.ok) throw new Error(`count failed: ${res.status}`);
    const text = await res.text();
    const n = Number(text);
    if (Number.isNaN(n)) throw new Error(`count is not a number: ${text}`);
    return n;
}

async function fetchPlayers() {
    const url = `/rest/players?pageNumber=${state.pageNumber}&pageSize=${state.pageSize}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`players failed: ${res.status}`);
    return await res.json();
}

function renderPlayers(players) {
    const tbody = document.getElementById("playersTbody");
    const rows = players.map(p => {
        const banned = p.banned ? "true" : "false";
        const birthday = formatDate(p.birthday);

        return `
      <tr data-id="${p.id}">
        <td data-field="id">${p.id}</td>
        <td data-field="name">${p.name}</td>
        <td data-field="title">${p.title}</td>
        <td data-field="race">${p.race}</td>
        <td data-field="profession">${p.profession}</td>
        <td data-field="level">${p.level}</td>
        <td data-field="birthday">${birthday}</td>
        <td data-field="banned">${banned}</td>

        <td class="cell-action">
          <button type="button" class="icon-btn" data-action="edit" data-id="${p.id}">
            <img class="icon" src="/img/edit.png" alt="Edit">
          </button>
        </td>

        <td class="cell-action">
          <button type="button" class="icon-btn" data-action="delete" data-id="${p.id}">
            <img class="icon" src="/img/delete.png" alt="Delete">
          </button>
        </td>
      </tr>
    `;
    }).join("");

    tbody.innerHTML = rows;
}

function renderPagination() {
    const box = document.getElementById("pagination");
    let html = "";

    for (let i = 0; i < state.pages; i++) {
        const active = i === state.pageNumber ? "active" : "";
        html += `<button class="page-btn ${active}" data-page="${i}">${i + 1}</button>`;
    }
    box.innerHTML = html;
}

function getEditedPayload(tr) {
    const name = tr.querySelector('[data-edit="name"]').value.trim();
    const title = tr.querySelector('[data-edit="title"]').value.trim();
    const race = tr.querySelector('[data-edit="race"]').value;
    const profession = tr.querySelector('[data-edit="profession"]').value;
    const banned = tr.querySelector('[data-edit="banned"]').checked;
    return { name, title, race, profession, banned };
}

function enterEditMode(id) {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;

    if (state.editingId !== null && state.editingId !== id) {
        exitEditMode(state.editingId);
    }

    const getText = (f) => tr.querySelector(`td[data-field="${f}"]`).textContent.trim();

    const name = getText("name");
    const title = getText("title");
    const race = getText("race");
    const profession = getText("profession");
    const banned = getText("banned") === "true";

    tr.dataset.origName = name;
    tr.dataset.origTitle = title;
    tr.dataset.origRace = race;
    tr.dataset.origProfession = profession;
    tr.dataset.origBanned = banned ? "true" : "false";

    tr.querySelector(`td[data-field="name"]`).innerHTML =
        `<input data-edit="name" value="${escapeAttr(name)}" maxlength="12">`;

    tr.querySelector(`td[data-field="title"]`).innerHTML =
        `<input data-edit="title" value="${escapeAttr(title)}" maxlength="30">`;

    tr.querySelector(`td[data-field="race"]`).innerHTML =
        `<select data-edit="race">${optionsHtml(RACES, race)}</select>`;

    tr.querySelector(`td[data-field="profession"]`).innerHTML =
        `<select data-edit="profession">${optionsHtml(PROFESSIONS, profession)}</select>`;

    tr.querySelector(`td[data-field="banned"]`).innerHTML =
        `<input data-edit="banned" type="checkbox" ${banned ? "checked" : ""}>`;

    const deleteBtn = tr.querySelector('button[data-action="delete"]');
    if (deleteBtn) deleteBtn.disabled = true;

    const editBtn = tr.querySelector('button[data-action="edit"]');
    if (editBtn) {
        const img = editBtn.querySelector("img");
        if (img) img.src = "/img/save.png";
    }

    state.editingId = id;
}

function exitEditMode(id) {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (!tr) {
        if (state.editingId === id) state.editingId = null;
        return;
    }

    tr.querySelector(`td[data-field="name"]`).textContent = tr.dataset.origName ?? "";
    tr.querySelector(`td[data-field="title"]`).textContent = tr.dataset.origTitle ?? "";
    tr.querySelector(`td[data-field="race"]`).textContent = tr.dataset.origRace ?? "";
    tr.querySelector(`td[data-field="profession"]`).textContent = tr.dataset.origProfession ?? "";
    tr.querySelector(`td[data-field="banned"]`).textContent = tr.dataset.origBanned ?? "false";

    const deleteBtn = tr.querySelector('button[data-action="delete"]');
    if (deleteBtn) deleteBtn.disabled = false;

    const editBtn = tr.querySelector('button[data-action="edit"]');
    if (editBtn) {
        const img = editBtn.querySelector("img");
        if (img) img.src = "/img/edit.png";
    }

    delete tr.dataset.origName;
    delete tr.dataset.origTitle;
    delete tr.dataset.origRace;
    delete tr.dataset.origProfession;
    delete tr.dataset.origBanned;

    if (state.editingId === id) state.editingId = null;
}

function clampPageNumber() {
    if (state.pages <= 0) state.pages = 1;
    if (state.pageNumber < 0) state.pageNumber = 0;
    if (state.pageNumber > state.pages - 1) state.pageNumber = state.pages - 1;
}

async function refresh() {
    setLoading(true);
    state.editingId = null;

    try {
        state.count = await fetchCount();
        state.pages = Math.max(1, Math.ceil(state.count / state.pageSize));
        clampPageNumber();

        const players = await fetchPlayers();
        renderPlayers(players);
        renderPagination();
    } finally {
        setLoading(false);
    }
}

async function deletePlayer(id) {
    const res = await fetch(`/rest/players/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE /rest/players/${id} failed: ${res.status}`);
}

async function savePlayer(id, payload) {
    const res = await fetch(`/rest/players/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`POST /rest/players/${id} failed: ${res.status} ${text}`);
    }
}

async function createPlayer(payload) {
    const res = await fetch(`/rest/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`POST /rest/players failed: ${res.status} ${text}`);
    }

    return await res.json();
}

function initCreateForm() {
    const raceSel = document.getElementById("createRace");
    const profSel = document.getElementById("createProfession");

    raceSel.innerHTML = optionsHtml(RACES, "HUMAN");
    profSel.innerHTML = optionsHtml(PROFESSIONS, "WARRIOR");

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    document.getElementById("createBirthday").value = `${yyyy}-${mm}-${dd}`;

    document.getElementById("createForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        setCreateError("");

        const name = document.getElementById("createName").value.trim();
        const title = document.getElementById("createTitle").value.trim();
        const race = document.getElementById("createRace").value;
        const profession = document.getElementById("createProfession").value;
        const level = Number(document.getElementById("createLevel").value);
        const birthdayStr = document.getElementById("createBirthday").value;
        const banned = document.getElementById("createBanned").checked;

        const msg = validateNameTitle(name, title);
        if (msg) {
            setCreateError(msg);
            showToast(msg, "err");
            return;
        }

        if (!Number.isFinite(level) || level < 0 || level > 100) {
            const m = "Level должен быть в диапазоне 0..100";
            setCreateError(m);
            showToast(m, "err");
            return;
        }

        const birthday = parseDateInputToMs(birthdayStr);
        if (!Number.isFinite(birthday)) {
            const m = "Birthday заполнен неверно";
            setCreateError(m);
            showToast(m, "err");
            return;
        }

        const payload = { name, title, race, profession, birthday, level, banned };

        const btn = document.getElementById("createBtn");
        btn.disabled = true;

        try {
            await createPlayer(payload);

            document.getElementById("createForm").reset();
            document.getElementById("createLevel").value = "1";
            document.getElementById("createRace").value = "HUMAN";
            document.getElementById("createProfession").value = "WARRIOR";
            document.getElementById("createBirthday").value = `${yyyy}-${mm}-${dd}`;
            document.getElementById("createBanned").checked = false;

            showToast("Создано", "ok");
            state.pageNumber = 0;
            await refresh();
        } catch (err) {
            console.error(err);
            const m = "Не удалось создать игрока (проверь данные)";
            setCreateError(m);
            showToast(m, "err");
        } finally {
            btn.disabled = false;
        }
    });
}

function wireEvents() {
    const pageSizeSelect = document.getElementById("pageSize");
    pageSizeSelect.value = String(state.pageSize);

    pageSizeSelect.addEventListener("change", async () => {
        if (state.isRefreshing) return;
        state.pageSize = Number(pageSizeSelect.value);
        state.pageNumber = 0;
        await refresh();
    });

    document.getElementById("pagination").addEventListener("click", async (e) => {
        if (state.isRefreshing) return;
        const btn = e.target.closest("button.page-btn");
        if (!btn) return;
        state.pageNumber = Number(btn.dataset.page);
        await refresh();
    });
}

document.getElementById("playersTbody").addEventListener("click", async (e) => {
    if (state.isRefreshing) return;

    const btn = e.target.closest("button.icon-btn");
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === "edit") {
        if (state.editingId !== null && state.editingId !== id) {
            exitEditMode(state.editingId);
        }

        if (state.editingId === id) {
            const tr = btn.closest("tr");
            const payload = getEditedPayload(tr);

            const msg = validateNameTitle(payload.name, payload.title);
            if (msg) {
                showToast(msg, "err");
                return;
            }

            btn.disabled = true;
            try {
                await savePlayer(id, payload);
                state.editingId = null;
                showToast("Сохранено", "ok");
                await refresh();
            } catch (e2) {
                console.error(e2);
                showToast("Не удалось сохранить", "err");
            } finally {
                btn.disabled = false;
            }
        } else {
            enterEditMode(id);
        }
        return;
    }

    if (action === "delete") {
        if (btn.disabled) return;

        if (!confirm(`Удалить игрока id=${id}?`)) return;

        btn.disabled = true;
        try {
            await deletePlayer(id);
            showToast("Удалено", "ok");
            await refresh();
        } catch (err) {
            console.error(err);
            showToast("Не удалось удалить", "err");
        } finally {
            btn.disabled = false;
        }
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    wireEvents();
    initCreateForm();
    await refresh();
});