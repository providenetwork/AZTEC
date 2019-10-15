async function createAccount() {
    const environment = this;
    if (!environment.browser) {
        throw new Error('Please initialise your environment first');
    }

    let homepage = await environment.openPage('https://www.aztecprotocol.com/');
    await homepage.initialiseAztec();

    await environment.metamask.approve();

    const registerPage = await environment.getPage(target => target.url().match(/register/));
    await registerPage.clickMain();
    await registerPage.clickMain();
    await registerPage.clickMain();

    await registerPage.typeMain('password');

    await registerPage.clickMain();
    await registerPage.clickMain();

    await environment.metamask.sign();

    const authorizePage = await environment.getPage(target => target.url().match(/register\/domain/));
    await authorizePage.clickMain();
}

module.exports = {
    createAccount
}