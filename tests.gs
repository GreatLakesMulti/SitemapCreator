
/**
 * Test function using the property URL `https://www.greatlakesdesigners.com`
 */
function testHandlePropertySheet() {
    const propertyName = "https://www.greatlakesdesigners.com";
    const currentTime = new Date();

    // Fetch URLs from the main sitemap
    const urlsFromSitemap = getPropertyUrls(propertyName);

    // Process and handle the property
    processPropertySheet(propertyName, urlsFromSitemap, currentTime);
}
