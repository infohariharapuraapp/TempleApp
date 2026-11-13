const languages = {
  te: "Telugu",
  kn: "Kannada",
  hi: "Hindi",
  ta: "Tamil"
};
const text = "Welcome to Divyakshetra Hariharapura Temple";
async function test() {
  for (const [code, name] of Object.entries(languages)) {
    try {
      const url = new URL("https://api.mymemory.translated.net/get");
      url.searchParams.set("q", text);
      url.searchParams.set("langpair", `en|${code}`);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000)
      });
      const data = await response.json();
      console.log(`\n${name}:`);
      console.log("Status:", data.responseStatus);
      console.log("Translation:", data.responseData?.translatedText);
    } catch (error) {
      console.log(`${name} failed:`, error.message);
    }
  }
}
test();
