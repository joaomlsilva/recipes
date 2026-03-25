/**
 * Recipe App
 * - Loads local recipes from recipes.json
 * - Displays a recipe card when a title is clicked
 * - Searches TheMealDB API for recipes online
 * - Allows saving API results to local (session) storage
 */

const MEALDB_SEARCH_URL = 'https://www.themealdb.com/api/json/v1/1/search.php?s=';
const MEALDB_LOOKUP_URL = 'https://www.themealdb.com/api/json/v1/1/lookup.php?i=';

// ─── State ───────────────────────────────────────────────
let localRecipes  = [];      // loaded from recipes.json
let savedRecipes  = [];      // saved API recipes (persisted in sessionStorage)
let customRecipes = [];      // user-created recipes (persisted in localStorage)
let activeRecipeId = null;   // currently displayed local recipe id

// ─── DOM refs ────────────────────────────────────────────
const recipeList        = document.getElementById('recipe-list');
const placeholder       = document.getElementById('placeholder');
const recipeCard        = document.getElementById('recipe-card');
const searchResults     = document.getElementById('search-results');
const searchInput       = document.getElementById('search-input');
const searchBtn         = document.getElementById('search-btn');
const closeSearchBtn    = document.getElementById('close-search-btn');
const searchResultsList = document.getElementById('search-results-list');
const searchResultsTitle= document.getElementById('search-results-title');
const noResultsMsg      = document.getElementById('no-results-msg');
const loading           = document.getElementById('loading');
const saveBtn           = document.getElementById('save-btn');

// Add Recipe modal
const addRecipeBtn      = document.getElementById('add-recipe-btn');
const recipeModal       = document.getElementById('recipe-modal');
const modalCloseBtn     = document.getElementById('modal-close-btn');
const modalCancelBtn    = document.getElementById('modal-cancel-btn');
const addRecipeForm     = document.getElementById('add-recipe-form');
const addIngredientBtn  = document.getElementById('add-ingredient-btn');
const addStepBtn        = document.getElementById('add-step-btn');
const ingredientsList   = document.getElementById('ingredients-list');
const stepsList         = document.getElementById('steps-list');
const formError         = document.getElementById('form-error');

// Card fields
const cardImage      = document.getElementById('card-image');
const cardTitle      = document.getElementById('card-title');
const cardMealType   = document.getElementById('card-meal-type');
const cardServes     = document.getElementById('card-serves');
const cardDifficulty = document.getElementById('card-difficulty');
const cardIngredients= document.getElementById('card-ingredients');
const cardSteps      = document.getElementById('card-steps');

// ─── Init ─────────────────────────────────────────────────
async function init() {
  loadSavedRecipes();
  loadCustomRecipes();
  await fetchLocalRecipes();
  renderSidebar();
}

// ─── Load local recipes.json ──────────────────────────────
async function fetchLocalRecipes() {
  try {
    const res = await fetch('recipes.json');
    if (!res.ok) throw new Error('Failed to load recipes.json');
    localRecipes = await res.json();
  } catch (err) {
    console.error(err);
    localRecipes = [];
  }
}

// ─── Session storage helpers ──────────────────────────────
function loadSavedRecipes() {
  try {
    const raw = sessionStorage.getItem('savedRecipes');
    savedRecipes = raw ? JSON.parse(raw) : [];
  } catch {
    savedRecipes = [];
  }
}

function persistSavedRecipes() {
  sessionStorage.setItem('savedRecipes', JSON.stringify(savedRecipes));
}

// ─── Custom recipes (localStorage) ───────────────────────
function loadCustomRecipes() {
  try {
    const raw = localStorage.getItem('customRecipes');
    customRecipes = raw ? JSON.parse(raw) : [];
  } catch {
    customRecipes = [];
  }
}

function persistCustomRecipes() {
  localStorage.setItem('customRecipes', JSON.stringify(customRecipes));
}

// ─── Sidebar rendering ────────────────────────────────────
function renderSidebar() {
  recipeList.innerHTML = '';

  const allRecipes = [
    ...localRecipes,
    ...customRecipes.filter(cr => !localRecipes.find(r => r.id === cr.id)),
    ...savedRecipes.filter(sr => !localRecipes.find(r => r.id === sr.id) &&
                                  !customRecipes.find(r => r.id === sr.id))
  ];

  if (allRecipes.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'No recipes yet.';
    empty.style.color = 'var(--clr-text-muted)';
    empty.style.fontStyle = 'italic';
    recipeList.appendChild(empty);
    return;
  }

  allRecipes.forEach(recipe => {
    const li = document.createElement('li');
    li.textContent = recipe.title;
    li.dataset.id = recipe.id;
    if (recipe.id === activeRecipeId) li.classList.add('active');
    li.addEventListener('click', () => showLocalRecipe(recipe));
    recipeList.appendChild(li);
  });
}

// ─── Show local recipe card ───────────────────────────────
function showLocalRecipe(recipe) {
  activeRecipeId = recipe.id;
  renderSidebar();
  hideSearchResults();
  renderCard(recipe, false);
}

function renderCard(recipe, isApiResult) {
  // Image
  if (recipe.image) {
    cardImage.src = recipe.image;
    cardImage.alt = recipe.title;
    cardImage.classList.remove('hidden');
    cardImage.onerror = () => cardImage.classList.add('hidden');
  } else {
    cardImage.classList.add('hidden');
  }

  // Title & meta
  cardTitle.textContent = recipe.title;
  cardMealType.textContent = recipe.mealType || 'Unknown';
  cardServes.textContent = recipe.serves ? `Serves ${recipe.serves}` : '';
  cardDifficulty.textContent = recipe.difficulty || 'Unknown';
  cardDifficulty.dataset.difficulty = recipe.difficulty || '';

  // Ingredients
  cardIngredients.innerHTML = '';
  (recipe.ingredients || []).forEach(ing => {
    const li = document.createElement('li');
    const amountSpan = document.createElement('span');
    amountSpan.className = 'ingredient-amount';
    amountSpan.textContent = ing.amount || '';
    const itemText = document.createTextNode(ing.item || '');
    li.appendChild(amountSpan);
    li.appendChild(itemText);
    cardIngredients.appendChild(li);
  });

  // Steps
  cardSteps.innerHTML = '';
  (recipe.steps || []).forEach(step => {
    const li = document.createElement('li');
    li.textContent = step;
    cardSteps.appendChild(li);
  });

  // Save button: only shown for API results not yet saved
  if (isApiResult) {
    const alreadySaved = savedRecipes.some(r => r.id === recipe.id) ||
                         localRecipes.some(r => r.id === recipe.id);
    saveBtn.classList.remove('hidden');
    saveBtn.disabled = alreadySaved;
    saveBtn.textContent = alreadySaved ? '✔ Already Saved' : '💾 Save Recipe';
    saveBtn.onclick = () => saveApiRecipe(recipe);
  } else {
    saveBtn.classList.add('hidden');
    saveBtn.onclick = null;
  }

  placeholder.classList.add('hidden');
  recipeCard.classList.remove('hidden');
}

// ─── Save API recipe locally ──────────────────────────────
function saveApiRecipe(recipe) {
  if (savedRecipes.some(r => r.id === recipe.id)) return;
  savedRecipes.push(recipe);
  persistSavedRecipes();
  saveBtn.disabled = true;
  saveBtn.textContent = '✔ Already Saved';
  renderSidebar();
}

// ─── Search ───────────────────────────────────────────────
async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  showLoading(true);
  recipeCard.classList.add('hidden');
  placeholder.classList.add('hidden');

  try {
    const res = await fetch(`${MEALDB_SEARCH_URL}${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('API request failed');
    const data = await res.json();
    renderSearchResults(query, data.meals);
  } catch (err) {
    console.error(err);
    renderSearchResults(query, null);
  } finally {
    showLoading(false);
  }
}

function renderSearchResults(query, meals) {
  searchResultsList.innerHTML = '';
  noResultsMsg.classList.add('hidden');
  activeRecipeId = null;
  renderSidebar();

  searchResultsTitle.textContent = `Results for "${query}"`;
  searchResults.classList.remove('hidden');

  if (!meals || meals.length === 0) {
    noResultsMsg.classList.remove('hidden');
    return;
  }

  meals.forEach(meal => {
    const li = document.createElement('li');

    const img = document.createElement('img');
    img.src = meal.strMealThumb ? `${meal.strMealThumb}/preview` : '';
    img.alt = meal.strMeal;
    img.className = 'result-thumb';
    img.onerror = () => img.style.display = 'none';

    const name = document.createElement('p');
    name.className = 'result-name';
    name.textContent = meal.strMeal;

    li.appendChild(img);
    li.appendChild(name);
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.addEventListener('click', () => fetchAndShowApiRecipe(meal.idMeal));
    li.addEventListener('keydown', e => { if (e.key === 'Enter') fetchAndShowApiRecipe(meal.idMeal); });

    searchResultsList.appendChild(li);
  });
}

// ─── Fetch full API recipe by ID and show card ────────────
async function fetchAndShowApiRecipe(mealId) {
  showLoading(true);
  try {
    const res = await fetch(`${MEALDB_LOOKUP_URL}${encodeURIComponent(mealId)}`);
    if (!res.ok) throw new Error('Lookup failed');
    const data = await res.json();
    const meal = data.meals && data.meals[0];
    if (!meal) throw new Error('Meal not found');

    const recipe = adaptApiMeal(meal);
    hideSearchResults();
    renderCard(recipe, true);
  } catch (err) {
    console.error(err);
  } finally {
    showLoading(false);
  }
}

/**
 * Adapts a TheMealDB meal object to the internal recipe format.
 */
function adaptApiMeal(meal) {
  // Build ingredients list from up to 20 ingredient/measure pairs
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const item   = meal[`strIngredient${i}`];
    const amount = meal[`strMeasure${i}`];
    if (item && item.trim()) {
      ingredients.push({ amount: (amount || '').trim(), item: item.trim() });
    }
  }

  // Split instructions into steps by sentence or numbered lines
  const rawSteps = (meal.strInstructions || '').trim();
  const steps = splitSteps(rawSteps);

  // Determine meal type from category (best-effort mapping)
  const categoryMap = {
    Breakfast: 'Breakfast',
    Starter:   'Snack',
    Side:      'Snack',
    Dessert:   'Snack',
    Lamb:      'Supper',
    Beef:      'Supper',
    Chicken:   'Supper',
    Pork:      'Supper',
    Seafood:   'Supper',
    Pasta:     'Supper',
    Vegetarian:'Lunch',
    Vegan:     'Lunch',
    Salad:     'Lunch',
  };
  const mealType = categoryMap[meal.strCategory] || 'Supper';

  return {
    id:          `api-${meal.idMeal}`,
    title:       meal.strMeal,
    mealType,
    serves:      null,   // MealDB does not provide serving count
    difficulty:  'Unknown',
    image:       meal.strMealThumb || '',
    ingredients,
    steps,
    source:      'api',
  };
}

/**
 * Splits a raw instruction string into an array of individual steps.
 */
function splitSteps(raw) {
  if (!raw) return [];

  // Try splitting by double newline first (common in MealDB)
  let parts = raw.split(/\r?\n\r?\n+/).map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;

  // Try splitting by single newline
  parts = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;

  // Fall back: split on sentence endings
  parts = raw.match(/[^.!?]+[.!?]+["']?/g) || [raw];
  return parts.map(s => s.trim()).filter(Boolean);
}

// ─── UI helpers ───────────────────────────────────────────
function hideSearchResults() {
  searchResults.classList.add('hidden');
  searchResultsList.innerHTML = '';
}

function showLoading(visible) {
  loading.classList.toggle('hidden', !visible);
}

// ─── Add Recipe Modal ─────────────────────────────────────
function openAddModal() {
  addRecipeForm.reset();
  formError.classList.add('hidden');
  formError.textContent = '';
  ingredientsList.innerHTML = '';
  stepsList.innerHTML = '';
  // Start with 3 ingredient rows and 2 step rows
  addIngredientRow();
  addIngredientRow();
  addIngredientRow();
  addStepRow();
  addStepRow();
  recipeModal.showModal();
}

function closeAddModal() {
  recipeModal.close();
}

function addIngredientRow(amountVal = '', itemVal = '') {
  const row = document.createElement('div');
  row.className = 'ingredient-row';

  const amountInput = document.createElement('input');
  amountInput.type = 'text';
  amountInput.name = 'ing-amount';
  amountInput.placeholder = 'Amount';
  amountInput.value = amountVal;
  amountInput.setAttribute('aria-label', 'Ingredient amount');

  const itemInput = document.createElement('input');
  itemInput.type = 'text';
  itemInput.name = 'ing-item';
  itemInput.placeholder = 'Ingredient name';
  itemInput.value = itemVal;
  itemInput.setAttribute('aria-label', 'Ingredient name');

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-remove-row';
  removeBtn.setAttribute('aria-label', 'Remove ingredient');
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    if (ingredientsList.children.length > 1) row.remove();
  });

  row.appendChild(amountInput);
  row.appendChild(itemInput);
  row.appendChild(removeBtn);
  ingredientsList.appendChild(row);
  itemInput.focus();
}

function addStepRow(val = '') {
  const row = document.createElement('div');
  row.className = 'step-row';

  const stepNum = document.createElement('span');
  stepNum.className = 'step-num';
  stepNum.style.cssText = 'min-width:20px;font-weight:700;color:var(--clr-primary);font-size:0.85rem;';

  const textarea = document.createElement('textarea');
  textarea.name = 'step-text';
  textarea.placeholder = 'Describe this step\u2026';
  textarea.value = val;
  textarea.rows = 2;
  textarea.setAttribute('aria-label', 'Step description');

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-remove-row';
  removeBtn.setAttribute('aria-label', 'Remove step');
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    if (stepsList.children.length > 1) {
      row.remove();
      updateStepNumbers();
    }
  });

  row.appendChild(stepNum);
  row.appendChild(textarea);
  row.appendChild(removeBtn);
  stepsList.appendChild(row);
  updateStepNumbers();
  textarea.focus();
}

function updateStepNumbers() {
  Array.from(stepsList.children).forEach((row, i) => {
    const num = row.querySelector('.step-num');
    if (num) num.textContent = `${i + 1}.`;
  });
}

function handleAddRecipe(e) {
  e.preventDefault();
  formError.classList.add('hidden');

  // Collect & validate
  const title      = document.getElementById('form-title').value.trim();
  const mealType   = document.getElementById('form-meal-type').value;
  const servesRaw  = document.getElementById('form-serves').value.trim();
  const difficulty = document.getElementById('form-difficulty').value;
  const image      = document.getElementById('form-image').value.trim();

  // Clear previous invalid states
  document.querySelectorAll('#add-recipe-form .invalid').forEach(el => el.classList.remove('invalid'));

  let valid = true;
  if (!title) {
    document.getElementById('form-title').classList.add('invalid');
    valid = false;
  }
  if (!mealType) {
    document.getElementById('form-meal-type').classList.add('invalid');
    valid = false;
  }

  // Ingredients: at least one item name filled
  const ingRows = Array.from(ingredientsList.querySelectorAll('.ingredient-row'));
  const ingredients = ingRows
    .map(row => ({
      amount: row.querySelector('[name="ing-amount"]').value.trim(),
      item:   row.querySelector('[name="ing-item"]').value.trim(),
    }))
    .filter(ing => ing.item);

  if (ingredients.length === 0) {
    ingRows.forEach(row => row.querySelector('[name="ing-item"]').classList.add('invalid'));
    valid = false;
  }

  // Steps: at least one non-empty step
  const stepRows = Array.from(stepsList.querySelectorAll('.step-row'));
  const steps = stepRows
    .map(row => row.querySelector('[name="step-text"]').value.trim())
    .filter(Boolean);

  if (steps.length === 0) {
    stepRows.forEach(row => row.querySelector('[name="step-text"]').classList.add('invalid'));
    valid = false;
  }

  if (!valid) {
    formError.textContent = 'Please fill in the required fields (marked with *).';
    formError.classList.remove('hidden');
    return;
  }

  const newRecipe = {
    id:         `custom-${Date.now()}`,
    title,
    mealType,
    serves:     servesRaw ? parseInt(servesRaw, 10) : null,
    difficulty: difficulty || 'Unknown',
    image:      image || '',
    ingredients,
    steps,
    source:     'custom',
  };

  customRecipes.push(newRecipe);
  persistCustomRecipes();
  renderSidebar();
  closeAddModal();
  showLocalRecipe(newRecipe);
}

// ─── Event Listeners ──────────────────────────────────────
addRecipeBtn.addEventListener('click', openAddModal);
modalCloseBtn.addEventListener('click', closeAddModal);
modalCancelBtn.addEventListener('click', closeAddModal);
addIngredientBtn.addEventListener('click', () => addIngredientRow());
addStepBtn.addEventListener('click', () => addStepRow());
addRecipeForm.addEventListener('submit', handleAddRecipe);

// Close modal on backdrop click
recipeModal.addEventListener('click', e => {
  if (e.target === recipeModal) closeAddModal();
});

searchBtn.addEventListener('click', handleSearch);

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSearch();
});

closeSearchBtn.addEventListener('click', () => {
  hideSearchResults();
  placeholder.classList.remove('hidden');
});

// ─── Boot ─────────────────────────────────────────────────
init();
