
/* ==========================================
   FREELANCECALC
   Advanced Payment Calculation Engine
   Version 2.0
   ========================================== */


/* 1. CONFIGURATION */

const BASE_PATH =
    window.FREELANCECALC_BASE_PATH || "";

const DATA_URL =
    `${BASE_PATH}/data/platforms.json`;

let calculatorData = null;


/* 2. ELEMENTS */

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

const withdrawalFeeElement =
    document.getElementById("withdrawalFee");


/* 3. CURRENCY FORMATTING */

function formatMoney(amount, currency) {
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency,
            maximumFractionDigits: 2
        }).format(amount);
    } catch {
        return amount.toFixed(2) + " " + currency;
    }
}


/* 4. LOAD PLATFORM DATA */

async function loadCalculatorData() {

    try {

        const response = await fetch(DATA_URL);

        if (!response.ok) {
            throw new Error("Could not load platform data.");
        }

        const data = await response.json();

        if (
            !data.metadata ||
            !Array.isArray(data.platforms)
        ) {
            throw new Error("Invalid platform data.");
        }

        calculatorData = data;

        loadPlatforms();

        calculatePayment();

    } catch (error) {

        console.error(error);

        resultDescription.textContent =
            "Calculator data could not be loaded.";

        calculateBtn.disabled = true;

        calculateBtn.textContent =
            "Calculator unavailable";
    }
}


/* 5. LOAD PLATFORMS DYNAMICALLY */

function loadPlatforms() {

    platformSelect.innerHTML = "";

    const enabledPlatforms =
        calculatorData.platforms.filter(platform => {
            return platform.enabled !== false;
        });

    enabledPlatforms.forEach(platform => {

        const option = document.createElement("option");

        option.value = platform.id;
        option.textContent = platform.name;

        platformSelect.appendChild(option);
    });

    if (enabledPlatforms.length === 0) {
        throw new Error("No payment platforms are available.");
    }
}


/* 6. EXCHANGE RATE ENGINE */

function getRate(currency) {

    const rates =
        calculatorData.metadata.default_exchange_rates;

    if (currency === "INR") {
        return 1;
    }

    const rate = Number(rates[currency + "_INR"]);

    if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(
            "Exchange rate unavailable for " + currency
        );
    }

    return rate;
}


function convertCurrency(amount, from, to) {

    if (from === to) {
        return amount;
    }

    const fromRate = getRate(from);
    const toRate = getRate(to);

    return amount * (fromRate / toRate);
}


/* 7. GET SELECTED PLATFORM */

function getSelectedPlatform() {

    return calculatorData.platforms.find(platform => {
        return platform.id === platformSelect.value;
    });
}


/* 8. VALIDATE FEE VALUES */

function validateFee(value, label) {

    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
        throw new Error("Invalid " + label + " configuration.");
    }

    return number;
}


/* 9. CALCULATE PLATFORM FEE */

function calculatePlatformFee(
    amount,
    currency,
    platform,
    rangeType = "default"
) {

    const model = platform.fee_model;

    let fee = 0;

    /* Percentage fee */

    if (model === "percentage") {

        const percentage = validateFee(
            platform.platform_fee_percent,
            "platform percentage"
        );

        fee = amount * percentage / 100;
    }

    /* Percentage + fixed fee */

    else if (model === "percentage_plus_fixed") {

        const percentage = validateFee(
            platform.platform_fee_percent,
            "platform percentage"
        );

        const percentageFee =
            amount * percentage / 100;

        const fixedCurrency =
            platform.fixed_fee_currency || currency;

        const fixedFee = convertCurrency(
            validateFee(platform.fixed_fee || 0, "fixed fee"),
            fixedCurrency,
            currency
        );

        fee = percentageFee + fixedFee;
    }

    /* Percentage range */

    else if (model === "percentage_range") {

        let percentage;

        if (rangeType === "min") {
            percentage = platform.platform_fee_percent_min;
        }

        else if (rangeType === "max") {
            percentage = platform.platform_fee_percent_max;
        }

        else {
            percentage = platform.default_fee_percent;
        }

        percentage = validateFee(
            percentage,
            "percentage range"
        );

        if (percentage > 100) {
            throw new Error("Invalid platform fee percentage.");
        }

        fee = amount * percentage / 100;
    }

    /* Flat tiered fee */

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
            throw new Error("No matching fee tier found.");
        }

        fee = convertCurrency(
            validateFee(selectedTier.fee, "tier fee"),
            selectedTier.fee_currency || currency,
            currency
        );
    }

    else {
        throw new Error(
            "Unsupported fee model: " + model
        );
    }

    return fee;
}


/* 10. WITHDRAWAL FEE */

function calculateWithdrawalFee(platform, targetCurrency) {

    const fee = validateFee(
        platform.withdrawal_fee || 0,
        "withdrawal fee"
    );

    const feeCurrency =
        platform.withdrawal_fee_currency || targetCurrency;

    return convertCurrency(
        fee,
        feeCurrency,
        targetCurrency
    );
}


/* 11. MAIN CALCULATION */

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
                "Enter a payment amount greater than zero."
            );
        }

        if (!platform || platform.enabled === false) {
            throw new Error(
                "Please select an available platform."
            );
        }

        /* Validate currency rates */

        getRate(baseCurrency);
        getRate(targetCurrency);

        /* Platform fee */

        const platformFee = calculatePlatformFee(
            amount,
            baseCurrency,
            platform
        );

        if (platformFee > amount) {
            throw new Error(
                "Platform fee exceeds the payment amount."
            );
        }

        const amountAfterPlatformFee =
            amount - platformFee;

        /* Exchange rate */

        const fxMarkup = validateFee(
            platform.fx_markup_percent || 0,
            "FX markup"
        );

        if (fxMarkup >= 100) {
            throw new Error("Invalid FX markup.");
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
            amountBeforeFX * fxMarkup / 100;

        const amountAfterConversion =
            amountBeforeFX - conversionFee;

        /* Withdrawal fee */

        const withdrawalFee = calculateWithdrawalFee(
            platform,
            targetCurrency
        );

        if (withdrawalFee > amountAfterConversion) {
            throw new Error(
                "Withdrawal fee exceeds the converted amount."
            );
        }

        const finalAmount =
            amountAfterConversion - withdrawalFee;

        /* Calculate fee range */

        let rangeDescription = "";

        if (platform.fee_model === "percentage_range") {

            const minimumFee = calculatePlatformFee(
                amount,
                baseCurrency,
                platform,
                "min"
            );

            const maximumFee = calculatePlatformFee(
                amount,
                baseCurrency,
                platform,
                "max"
            );

            const minimumReceived =
                (amount - maximumFee) *
                grossExchangeRate *
                (1 - fxMarkup / 100) -
                withdrawalFee;

            const maximumReceived =
                (amount - minimumFee) *
                grossExchangeRate *
                (1 - fxMarkup / 100) -
                withdrawalFee;

            rangeDescription =
                " Estimated receipt range: " +
                formatMoney(minimumReceived, targetCurrency) +
                " – " +
                formatMoney(maximumReceived, targetCurrency) +
                ".";
        }

        /* DISPLAY RESULTS */

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

        if (withdrawalFeeElement) {
            withdrawalFeeElement.textContent =
                formatMoney(withdrawalFee, targetCurrency);
        }

        resultDescription.textContent =
            "Estimated result using " +
            platform.name +
            "." +
            rangeDescription;

    } catch (error) {

        console.error(error);

        receivedAmount.textContent = "—";

        originalAmount.textContent = "—";
        platformFeeElement.textContent = "—";
        conversionFeeElement.textContent = "—";
        exchangeRateElement.textContent = "—";
        finalAmountElement.textContent = "—";

        if (withdrawalFeeElement) {
            withdrawalFeeElement.textContent = "—";
        }

        resultDescription.textContent =
            error.message;
    }
}


/* 12. EVENT LISTENERS */

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


/* 13. START ENGINE */

if (
    amountInput &&
    fromCurrency &&
    toCurrency &&
    platformSelect &&
    calculateBtn &&
    receivedAmount &&
    resultDescription &&
    originalAmount &&
    platformFeeElement &&
    conversionFeeElement &&
    exchangeRateElement &&
    finalAmountElement
) {
    loadCalculatorData();
}