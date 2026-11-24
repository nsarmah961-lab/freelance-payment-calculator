
/* ==========================================
   FREELANCECALC
   Payment Calculation Engine
   ========================================== */

const DATA_URL = "/data/platforms.json";

let calculatorData = null;


/* 1. ELEMENTS */

const amountInput = document.getElementById("amount");
const fromCurrency = document.getElementById("fromCurrency");
const toCurrency = document.getElementById("toCurrency");
const platformSelect = document.getElementById("platform");
const calculateBtn = document.getElementById("calculateBtn");

const receivedAmount = document.getElementById("receivedAmount");
const resultDescription = document.getElementById("resultDescription");
const originalAmount = document.getElementById("originalAmount");
const platformFeeElement = document.getElementById("platformFee");
const conversionFeeElement = document.getElementById("conversionFee");
const exchangeRateElement = document.getElementById("exchangeRate");
const finalAmountElement = document.getElementById("finalAmount");


/* 2. CURRENCY FORMATTING */

function formatMoney(amount, currency) {
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: currency,
            maximumFractionDigits: 2
        }).format(amount);
    } catch {
        return amount.toFixed(2) + " " + currency;
    }
}


/* 3. LOAD PLATFORM DATA */

async function loadCalculatorData() {
    try {
        const response = await fetch(DATA_URL);

        if (!response.ok) {
            throw new Error("Could not load platform data.");
        }

        calculatorData = await response.json();

        if (
            !calculatorData.metadata ||
            !Array.isArray(calculatorData.platforms)
        ) {
            throw new Error("Platform data format is invalid.");
        }

        calculatePayment();

    } catch (error) {
        console.error(error);

        resultDescription.textContent =
            "Calculator data could not be loaded. Please try again later.";

        calculateBtn.disabled = true;
        calculateBtn.textContent = "Calculator unavailable";
    }
}


/* 4. GET EXCHANGE RATE */

function getRate(currency) {
    const rates =
        calculatorData.metadata.default_exchange_rates;

    if (currency === "INR") {
        return 1;
    }

    const rate = rates[currency + "_INR"];

    if (!rate || rate <= 0) {
        throw new Error(
            "Exchange rate unavailable for " + currency
        );
    }

    return rate;
}


/* 5. CONVERT BETWEEN CURRENCIES */

function convertCurrency(amount, from, to) {
    const fromRate = getRate(from);
    const toRate = getRate(to);

    return amount * (fromRate / toRate);
}


/* 6. FIND SELECTED PLATFORM */

function getSelectedPlatform() {
    return calculatorData.platforms.find(platform => {
        return platform.id === platformSelect.value;
    });
}


/* 7. CALCULATE PLATFORM FEE */

function calculatePlatformFee(amount, currency, platform) {

    const model = platform.fee_model;

    let fee = 0;

    /* Percentage fee */

    if (model === "percentage") {
        fee =
            amount *
            (Number(platform.platform_fee_percent) / 100);
    }

    /* Percentage + fixed fee */

    else if (model === "percentage_plus_fixed") {

        const percentageFee =
            amount *
            (Number(platform.platform_fee_percent) / 100);

        const fixedCurrency =
            platform.fixed_fee_currency || currency;

        const fixedFee = convertCurrency(
            Number(platform.fixed_fee || 0),
            fixedCurrency,
            currency
        );

        fee = percentageFee + fixedFee;
    }

    /* Percentage range */

    else if (model === "percentage_range") {

        const percentage =
            Number(platform.default_fee_percent);

        fee = amount * (percentage / 100);
    }

    /* Flat or tiered fee */

    else if (model === "flat_tiered") {

        const tiers = platform.tiers || [];

        const selectedTier = tiers.find(tier => {

            const maximum =
                tier.max_transaction_amount;

            return (
                maximum === null ||
                maximum === undefined ||
                amount <= convertCurrency(
                    Number(maximum),
                    tier.fee_currency || currency,
                    currency
                )
            );
        });

        if (!selectedTier) {
            throw new Error(
                "No matching fee tier found for this payment."
            );
        }

        fee = convertCurrency(
            Number(selectedTier.fee),
            selectedTier.fee_currency || currency,
            currency
        );
    }

    else {
        throw new Error(
            "Unsupported fee model: " + model
        );
    }

    if (!Number.isFinite(fee) || fee < 0) {
        throw new Error("Invalid platform fee configuration.");
    }

    return fee;
}


/* 8. MAIN CALCULATION */

function calculatePayment() {

    if (!calculatorData) {
        return;
    }

    try {

        const amount = Number(amountInput.value);

        const baseCurrency = fromCurrency.value;
        const targetCurrency = toCurrency.value;

        const platform = getSelectedPlatform();

        /* Validate amount */

        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error(
                "Please enter a payment amount greater than zero."
            );
        }

        if (!platform || platform.enabled === false) {
            throw new Error(
                "Please select an available payment platform."
            );
        }

        /* Calculate platform fee */

        const platformFee = calculatePlatformFee(
            amount,
            baseCurrency,
            platform
        );

        if (platformFee > amount) {
            throw new Error(
                "The estimated platform fee exceeds your payment amount."
            );
        }

        /* Remaining amount */

        const amountAfterPlatformFee =
            amount - platformFee;

        /* FX markup */

        const fxMarkup =
            Number(platform.fx_markup_percent || 0);

        if (!Number.isFinite(fxMarkup) || fxMarkup < 0 || fxMarkup >= 100) {
            throw new Error("Invalid FX markup configuration.");
        }

        const grossExchangeRate = convertCurrency(
            1,
            baseCurrency,
            targetCurrency
        );

        const effectiveExchangeRate =
            grossExchangeRate * (1 - fxMarkup / 100);

        /* Currency conversion */

        const amountBeforeFX =
            amountAfterPlatformFee * grossExchangeRate;

        const conversionFee =
            amountBeforeFX * (fxMarkup / 100);

        const finalAmount =
            amountBeforeFX - conversionFee;

        /* Display results */

        receivedAmount.textContent =
            formatMoney(finalAmount, targetCurrency);

        originalAmount.textContent =
            formatMoney(amount, baseCurrency);

        platformFeeElement.textContent =
            formatMoney(platformFee, baseCurrency);

        conversionFeeElement.textContent =
            formatMoney(conversionFee, targetCurrency);

        exchangeRateElement.textContent =
            "1 " + baseCurrency + " = " +
            effectiveExchangeRate.toFixed(4) +
            " " + targetCurrency;

        finalAmountElement.textContent =
            formatMoney(finalAmount, targetCurrency);

        resultDescription.textContent =
            "Estimated result using " +
            platform.name +
            " fee assumptions.";

    } catch (error) {

        receivedAmount.textContent = "—";

        originalAmount.textContent = "—";
        platformFeeElement.textContent = "—";
        conversionFeeElement.textContent = "—";
        exchangeRateElement.textContent = "—";
        finalAmountElement.textContent = "—";

        resultDescription.textContent = error.message;

    }
}


/* 9. EVENT LISTENERS */

if (calculateBtn) {
    calculateBtn.addEventListener(
        "click",
        calculatePayment
    );
}

if (amountInput) {
    amountInput.addEventListener(
        "input",
        calculatePayment
    );
}

if (fromCurrency) {
    fromCurrency.addEventListener(
        "change",
        calculatePayment
    );
}

if (toCurrency) {
    toCurrency.addEventListener(
        "change",
        calculatePayment
    );
}

if (platformSelect) {
    platformSelect.addEventListener(
        "change",
        calculatePayment
    );
}


/* 10. START CALCULATOR */

if (
    amountInput &&
    fromCurrency &&
    toCurrency &&
    platformSelect &&
    calculateBtn
) {
    loadCalculatorData();
}