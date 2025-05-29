// Supabase config
const SUPABASE_URL = "https://ravmholvgvwlbthsauxe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdm1ob2x2Z3Z3bGJ0aHNhdXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyMzk0NjQsImV4cCI6MjA2MzgxNTQ2NH0.JJlID_56B4BygiVoR_z7EvMwy8oglkWl-Ri07J2iRa0";

if (typeof supabase === 'undefined') {
  console.error("Supabase JS library not loaded. Ensure the CDN script is included and loaded correctly.");
  throw new Error("Supabase JS library not loaded");
}
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Audio for success
const successSound = new Audio('https://www.soundjay.com/buttons/beep-01a.mp3');

// Show notification function
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  if (!notification) {
    console.warn("Notification element not found on this page.");
    return;
  }
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'flex';
  
  if (type === 'success') {
    successSound.play().catch(err => console.log('Audio play failed:', err));
  }

  setTimeout(() => {
    notification.style.display = 'none';
  }, 5000);
}

// Calculate price trend (simple comparison with previous price)
async function getPriceTrend(cropName, location, currentPrice) {
  try {
    const { data, error } = await supabaseClient
      .from('market_prices')
      .select('price_per_kg')
      .eq('crop_name', cropName)
      .eq('location', location)
      .order('created_at', { ascending: false })
      .limit(2);

    if (error) throw error;

    if (!data || data.length < 2) return '';
    const previousPrice = data[1].price_per_kg;
    return currentPrice > previousPrice ? 'trend-up' : currentPrice < previousPrice ? 'trend-down' : '';
  } catch (error) {
    console.error("Error calculating price trend:", error);
    return '';
  }
}

// INDEX.HTML: Enhanced table loading
async function fetchMarketPrices() {
  const tableBody = document.querySelector("#marketTable tbody");
  const loadingMsg = document.getElementById("loading-message");
  const emptyState = document.getElementById("empty-state");

  if (!tableBody) return;

  loadingMsg.style.display = "flex";
  tableBody.innerHTML = '';

  try {
    const { data, error } = await supabaseClient
      .from('market_prices')
      .select('crop_name, location, price_per_kg, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    loadingMsg.style.display = "none";

    if (error) throw error;

    if (!data || data.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    let tableRows = '';
    for (const row of data) {
      const trend = await getPriceTrend(row.crop_name, row.location, row.price_per_kg);
      tableRows += `
        <tr>
          <td>${row.crop_name}</td>
          <td>${row.location}</td>
          <td class="${trend}">${row.price_per_kg.toFixed(2)}</td>
        </tr>
      `;
    }
    tableBody.innerHTML = tableRows;
  } catch (error) {
    loadingMsg.style.display = "none";
    showNotification("Failed to load market prices", "error");
    console.error("Error fetching market prices:", error);
  }
}

// MARKET.HTML: Enhanced card loading
async function loadMarketPrices() {
  const priceList = document.getElementById('price-list');
  const loadingMsg = document.getElementById("loading-message");

  if (!priceList) return;

  loadingMsg.style.display = "flex";
  priceList.innerHTML = '';

  try {
    const { data, error } = await supabaseClient
      .from('market_prices')
      .select('crop_name, location, price_per_kg, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    loadingMsg.style.display = "none";

    if (error) throw error;

    if (!data || data.length === 0) {
      priceList.innerHTML = `
        <div class="empty-state">
          <p>No prices available yet. Be the first to <a href="add-crop.html">add a price</a>!</p>
        </div>
      `;
      return;
    }

    let priceCards = '';
    for (const item of data) {
      const trend = await getPriceTrend(item.crop_name, item.location, item.price_per_kg);
      priceCards += `
        <div class="price-card">
          <strong>${item.crop_name}</strong>
          <div class="location">📍 ${item.location}</div>
          <div class="price ${trend}">Ksh ${item.price_per_kg.toFixed(2)}/kg</div>
          <div class="time">🕒 ${new Date(item.created_at).toLocaleString()}</div>
        </div>
      `;
    }
    priceList.innerHTML = priceCards;
  } catch (error) {
    loadingMsg.style.display = "none";
    priceList.innerHTML = `
      <div class="error-card">
        <p>Failed to load prices. Please try again later.</p>
      </div>
    `;
    showNotification("Failed to load market prices", "error");
    console.error("Error loading market prices:", error);
  }
}

// ADD-CROP.HTML: Enhanced form handling
const cropForm = document.getElementById("add-crop-form");
if (cropForm) {
  const priceInput = document.getElementById("price");
  const sellerContactInput = document.getElementById("seller-contact");

  priceInput.addEventListener('input', (e) => {
    if (parseFloat(e.target.value) < 0) {
      e.target.setCustomValidity("Price cannot be negative");
    } else {
      e.target.setCustomValidity("");
    }
  });

  sellerContactInput.addEventListener('input', (e) => {
    const phonePattern = /^[0-9]{10}$/;
    if (!phonePattern.test(e.target.value)) {
      e.target.setCustomValidity("Please enter a valid 10-digit phone number (e.g., 0712345678)");
    } else {
      e.target.setCustomValidity("");
    }
  });

  cropForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const cropName = document.getElementById("crop-name").value.trim();
    const location = document.getElementById("location").value.trim();
    const price = parseFloat(document.getElementById("price").value);
    const sellerContact = document.getElementById("seller-contact").value.trim();
    const statusMsg = document.getElementById("status-message");

    statusMsg.textContent = "";
    statusMsg.className = "";

    if (!cropName || !location || isNaN(price) || price <= 0 || !/^[0-9]{10}$/.test(sellerContact)) {
      statusMsg.textContent = "Please fill all fields correctly (price must be greater than 0, phone number must be 10 digits)";
      statusMsg.className = "error-message";
      return;
    }

    console.log("Submitting data:", { crop_name: cropName, location, price_per_kg: price, seller_contact: sellerContact });

    try {
      const { error } = await supabaseClient
        .from('market_prices')
        .insert([{ 
          crop_name: cropName, 
          location, 
          price_per_kg: price,
          seller_contact: sellerContact
        }]);

      if (error) throw error;

      statusMsg.textContent = "Price added successfully!";
      statusMsg.className = "success-message";
      cropForm.reset();
      showNotification("Price added successfully!");
      
      setTimeout(() => {
        if (window.location.pathname.includes('market.html')) {
          loadMarketPrices();
        } else {
          fetchMarketPrices();
        }
      }, 1000);
    } catch (error) {
      statusMsg.textContent = `Failed to add data: ${error.message}`;
      statusMsg.className = "error-message";
      showNotification("Failed to add price", "error");
      console.error("Supabase insert error:", error);
    }
  });
}

// MARKET-MATCH.HTML: Enhanced matching
const matchForm = document.getElementById("match-form");
if (matchForm) {
  matchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const crop = document.getElementById("match-crop").value.trim().toLowerCase();
    const location = document.getElementById("match-location").value.trim().toLowerCase();
    const resultsContainer = document.getElementById("match-results");
    const loadingMsg = document.createElement('div');
    
    loadingMsg.innerHTML = '<div class="loading-spinner"></div><p>Searching for matches...</p>';
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(loadingMsg);

    try {
      const { data, error } = await supabaseClient
        .from('market_prices')
        .select('*');

      if (error) throw error;

      const matches = data.filter(item =>
        item.crop_name.toLowerCase().includes(crop) &&
        item.location.toLowerCase().includes(location)
      );

      resultsContainer.innerHTML = '';
      
      if (matches.length === 0) {
        resultsContainer.innerHTML = `
          <div class="empty-result">
            <p>No matches found for "${crop}" in "${location}"</p>
            <p>Try a different search or <a href="add-crop.html">add a price</a></p>
          </div>
        `;
      } else {
        let matchCards = '';
        for (const item of matches) {
          const trend = await getPriceTrend(item.crop_name, item.location, item.price_per_kg);
          matchCards += `
            <div class="price-card match-card">
              <h3>${item.crop_name}</h3>
              <div class="location">📍 ${item.location}</div>
              <div class="price ${trend}">Ksh ${item.price_per_kg.toFixed(2)}/kg</div>
              <div class="contact">
                <button class="contact-btn" data-id="${item.id}" data-contact="${item.seller_contact || 'Not provided'}">Contact Seller</button>
                <div class="contact-info" style="display: none; margin-top: 10px; color: #1f2937;"></div>
              </div>
            </div>
          `;
        }
        resultsContainer.innerHTML = matchCards;

        // Add event listener for Contact Seller buttons
        document.querySelectorAll('.contact-btn').forEach(button => {
          button.addEventListener('click', (e) => {
            const contact = e.target.getAttribute('data-contact');
            const contactInfoDiv = e.target.nextElementSibling;

            if (contact === 'Not provided') {
              contactInfoDiv.textContent = 'Seller contact not available.';
              contactInfoDiv.style.display = 'block';
              showNotification('No contact information available for this seller.', 'error');
              return;
            }

            // Display the phone number with a clickable link to initiate a call
            contactInfoDiv.innerHTML = `📞 Seller Contact: <a href="tel:${contact}">${contact}</a>`;
            contactInfoDiv.style.display = 'block';
            showNotification('Contact information revealed! Click to call the seller.', 'success');

            // Optionally, hide the button after clicking
            e.target.style.display = 'none';
          });
        });
      }
    } catch (error) {
      resultsContainer.innerHTML = `
        <div class="error-card">
          <p>Search failed. Please try again later.</p>
        </div>
      `;
      showNotification("Search failed. Please try again.", "error");
      console.error("Search error:", error);
    }
  });
}

// Initialize appropriate functions based on current page
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('#marketTable')) {
    fetchMarketPrices();
  }
  
  if (document.getElementById('price-list')) {
    loadMarketPrices();
  }
});