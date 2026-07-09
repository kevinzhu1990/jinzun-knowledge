(function () {
  const allowedCodes = new Set([
    "0206",
    "1122",
    "1133",
    "1753",
    "1761",
    "1956",
    "1966",
    "1972",
    "2067",
    "2212",
    "2277",
    "2318",
    "2319",
    "2397",
    "2398",
    "2415",
    "2423",
    "2425",
    "2522",
    "2528",
    "2535",
    "2536",
    "2538",
    "2552",
    "2557",
    "2602",
    "2605",
    "2621",
    "1658",
    "2547",
    "2616",
    "2617",
    "2618",
    "2307",
    "2631",
    "2622",
    "2607",
    "2637",
    "1391",
    "1392",
    "1393",
    "1930",
    "1937",
    "1940",
    "2175",
    "2176",
    "2545",
  ]);

  const originalFetch = window.fetch.bind(window);

  const isProductQuizUrl = (input) => {
    const raw = typeof input === "string" ? input : input?.url;
    if (!raw) return false;
    try {
      const path = decodeURIComponent(new URL(raw, window.location.href).pathname);
      return path.includes("/outputs/product_quiz/") && path.endsWith("金尊产品知识库题库.json");
    } catch {
      return String(raw).includes("outputs/product_quiz");
    }
  };

  const getCode = (question) => {
    const code = String(question?.code || "").trim().match(/^\d{4}/)?.[0];
    if (code) return code;
    return String(question?.productName || "").trim().match(/^\d{4}/)?.[0] || "";
  };

  const isMooncakeQuestion = (question) => {
    const fields = [
      question?.bank,
      question?.category,
      question?.productLine,
      question?.productName,
      question?.question,
    ].map((value) => String(value || ""));
    return fields.some((value) => value.includes("月饼"));
  };

  const filterQuestions = (questions) =>
    Array.isArray(questions)
      ? questions.filter((question) => !isMooncakeQuestion(question) || allowedCodes.has(getCode(question)))
      : questions;

  window.JZ_MOONCAKE_ALLOWED_CODES = [...allowedCodes];
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (!isProductQuizUrl(args[0])) return response;
    try {
      const data = await response.clone().json();
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/json;charset=utf-8");
      return new Response(JSON.stringify(filterQuestions(data), null, 2), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return response;
    }
  };
})();
