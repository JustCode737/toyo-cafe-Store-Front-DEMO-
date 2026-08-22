// REPLACE THIS with your deployed Google Apps Script Web App URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw5LGlA6CUBLwAK1Dpp2qOdqYxrYL2t6xFbStZrwk0nUPKeh2q-xKe7SMYjcDv91QZ_Wg/exec";

let cart = [];
let lastSubmissionTime = 0;
const COOLDOWN_PERIOD = 10000; // 10-second cooldown between orders

function toggleCart() {
    const drawer = document.getElementById('cart-drawer');
    drawer.classList.toggle('hidden');
    renderCart();
}

function addToCart(name, price, cardElement) {
    let selectedColor = "Default";
    if (cardElement) {
        selectedColor = cardElement.getAttribute('data-selected-color') || "Default";
    }

    const existingItem = cart.find(item => item.name === name && item.color === selectedColor);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ name, price, quantity: 1, color: selectedColor });
    }
    updateCartBadge();
    renderCart();
}

// Function to increase item quantity from the cart drawer
function increaseQuantity(index) {
    cart[index].quantity += 1;
    updateCartBadge();
    renderCart();
}

// Function to decrease item quantity, or remove it if quantity drops below 1
function decreaseQuantity(index) {
    if (cart[index].quantity > 1) {
        cart[index].quantity -= 1;
    } else {
        cart.splice(index, 1);
    }
    updateCartBadge();
    renderCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartBadge();
    renderCart();
}

function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (totalCount > 0) {
        badge.textContent = totalCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function renderCart() {
    const container = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('cart-subtotal');
    container.innerHTML = '';

    if (cart.length === 0) {
        container.innerHTML = '<p class="text-stone-500 text-center py-8 text-sm">Your cart is empty.</p>';
        subtotalEl.textContent = '₱0.00';
        return;
    }

    let subtotal = 0;
    cart.forEach((item, index) => {
        subtotal += item.price * item.quantity;
        const itemEl = document.createElement('div');
        itemEl.className = 'py-4 flex justify-between items-center';
        
        const colorDisplay = item.color && item.color !== "Default" ? `<span class="text-xs text-amber-700 font-medium block">Color: ${item.color}</span>` : '';

        itemEl.innerHTML = `
            <div>
                <h4 class="text-sm font-medium text-stone-900">${item.name}</h4>
                ${colorDisplay}
                <p class="text-xs text-stone-500">₱${item.price.toFixed(2)} each</p>
            </div>
            <div class="flex items-center space-x-3">
                <div class="flex items-center border border-stone-300 rounded overflow-hidden">
                    <button onclick="decreaseQuantity(${index})" class="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs transition"><i class="fa-solid fa-minus"></i></button>
                    <span class="px-3 text-xs font-medium text-stone-900">${item.quantity}</span>
                    <button onclick="increaseQuantity(${index})" class="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs transition"><i class="fa-solid fa-plus"></i></button>
                </div>
                <span class="text-sm font-bold text-stone-900 w-16 text-right">₱${(item.price * item.quantity).toFixed(2)}</span>
                <button onclick="removeFromCart(${index})" class="text-stone-400 hover:text-red-600 text-sm ml-1"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(itemEl);
    });

    subtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
}

function openCheckoutModal() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    toggleCart(); // Close cart drawer
    const modalTotal = document.getElementById('modal-total');
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    modalTotal.textContent = `₱${subtotal.toFixed(2)}`;
    document.getElementById('checkout-modal').classList.remove('hidden');
}

function closeCheckoutModal() {
    document.getElementById('checkout-modal').classList.add('hidden');
}

// Image file converter helper for Base64 upload to Google Drive
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function handleCheckoutSubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('submit-order-btn');

    // 1. Check Rate Limiting Cooldown
    const currentTime = Date.now();
    if (currentTime - lastSubmissionTime < COOLDOWN_PERIOD) {
        const remainingTime = Math.ceil((COOLDOWN_PERIOD - (currentTime - lastSubmissionTime)) / 1000);
        alert(`Please wait ${remainingTime} seconds before submitting another order.`);
        return;
    }

    // 2. Verify if reCAPTCHA challenge has been completed
    const captchaResponse = grecaptcha.getResponse();
    if (captchaResponse.length === 0) {
        alert('Please complete the CAPTCHA challenge to prove you are human.');
        return;
    }

    const name = document.getElementById('cust-name').value;
    const address = document.getElementById('cust-address').value;
    const phone = document.getElementById('cust-phone').value;
    const proofFile = document.getElementById('cust-proof').files[0];

    // 3. Validate Proof of Payment File (Type and Size)
    if (proofFile) {
        if (!proofFile.type.startsWith('image/')) {
            alert('Please upload a valid image file (JPEG, PNG, etc.).');
            return;
        }

        const maxSizeInBytes = 5 * 1024 * 1024; // 5MB limit
        if (proofFile.size > maxSizeInBytes) {
            alert('File size is too large. Please upload an image smaller than 5MB.');
            return;
        }
    }

    submitBtn.textContent = 'Submitting Order...';
    submitBtn.disabled = true;

    let proofBase64 = "";
    if (proofFile) {
        try {
            proofBase64 = await convertFileToBase64(proofFile);
        } catch (err) {
            console.error("Error reading file", err);
        }
    }

    const itemsSummary = cart.map(item => {
        const colorInfo = item.color && item.color !== "Default" ? ` [Color: ${item.color}]` : '';
        return `${item.name}${colorInfo} (x${item.quantity})`;
    }).join(', ');

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const payload = {
        timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
        customer: { name, phone, address },
        items: itemsSummary,
        total: `₱${totalAmount.toFixed(2)}`,
        proof_of_payment: proofBase64,
        recaptcha_response: captchaResponse
    };

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log("Server response:", result);

        alert('Order placed successfully! Thank you.');
        cart = [];
        updateCartBadge();
        document.getElementById('checkout-form').reset();
        
        // Reset the reCAPTCHA widget for subsequent tests/orders
        grecaptcha.reset();

        // Record successful submission time to trigger cooldown
        lastSubmissionTime = Date.now();

        closeCheckoutModal();
    } catch (error) {
        console.error('Error submitting order:', error);
        alert('There was an error submitting your order. Please try again.');
    } finally {
        submitBtn.textContent = 'Confirm & Place Order';
        submitBtn.disabled = false;
    }
}

function changeColor(imgId, newImageSrc, swatchElement) {
    var imgElement = document.getElementById(imgId);
    if (imgElement.src.includes(newImageSrc)) return;

    imgElement.classList.add('changing');
    setTimeout(function() {
        imgElement.src = newImageSrc;
        imgElement.classList.remove('changing');
    }, 300);

    var parentCard = swatchElement.closest('.product-card');
    if (parentCard) {
        parentCard.setAttribute('data-selected-color', swatchElement.getAttribute('title'));
    }

    var parentSwatches = swatchElement.closest('.color-swatches').querySelectorAll('.swatch');
    parentSwatches.forEach(function(s) {
        s.classList.remove('active');
    });
    swatchElement.classList.add('active');
}

function openModal(imgElement) {
    var modal = document.getElementById('imageModal');
    var modalImg = document.getElementById('modalImg');
    modal.style.display = 'flex';
    modalImg.src = imgElement.src;
}

function closeModal(event) {
    if (event.target.id === 'imageModal' || event.target.classList.contains('modal-close')) {
        document.getElementById('imageModal').style.display = 'none';
    }
}
