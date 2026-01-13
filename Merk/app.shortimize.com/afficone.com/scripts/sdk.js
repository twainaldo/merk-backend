const affiHelpers = {
    getCookie: (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    },
    setCookie: (name, value, days) => {
        let expires = '';
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = '; Expires=' + date.toUTCString();
        }

        document.cookie = name + '=' + (value || null) + expires + `; Domain=.${window.location.host.split('.').slice(-2).join('.')}; Path=/`;
        if (affiHelpers.getCookie(name) !== value) {
            document.cookie = name + '=' + (value || null) + expires + `; Domain=${window.location.host.split('.').slice(-3).join('.')}; Path=/`;
        }
    },
    appendStripeCri: (href) => {
        const url = new URL(href);
        url.searchParams.append('client_reference_id', window.Afficone.referral);
        return url.href;
    }
};

const affiData = {"name":"Shortimize","prefix":"shortimize","token":"0698768325411881","portalUrl":"https://affiliate.shortimize.com","active":true,"sdk":"stripe","trackingParameter":"ref","cookieName":"ref","cookieDuration":180,"widget":{"enabled":false,"svgIcon":"<svg viewBox=\"0 0 576 512\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z\"></path></svg>","includedRoutes":[],"title":"Refer a friend","description":"Know someone who might like our product? For each referral you can earn 10% of their purchase.","buttonText":"Apply Now"},"commissions":{"amount":10.0,"type":0,"applyIndividual":true}};

window.Afficone = {
    affiData,
    process,
    conversion,
    renderWidget,
    referral: affiHelpers.getCookie(affiData.cookieName)
};

async function initialize() {
    if (affiData.sdk === 'shopify') {
        console.log('🚧 Affiliate plugin by Afficone 🚧\nStart an affiliate program for your Shopify store: https://afficone.com');
    }

    if (affiData.error) {
        console.error(`⚠️ Afficone error: ${affiData.message}`);
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const ref = params.get(affiData.trackingParameter);

    if (ref !== null) {
        try {
            await fetch(`https://api.afficone.com/track/${affiData.token}/click/${ref}`, {
                mode: 'no-cors'
            });
        } catch {}

        affiHelpers.setCookie(affiData.cookieName, ref, affiData.cookieDuration);
    } else {
        console.log('No referral parameter found.');
    }

    const cookie = affiHelpers.getCookie(affiData.cookieName);
    window.Afficone.referral = cookie;

    if (cookie !== null) {
        console.log('Referral cookie found.')
        await process();
    }

    if (affiData.widget.enabled) {
        renderWidget();
    }
}

initialize();

async function process() {
    if (affiData.sdk === null) {
        console.log('No valid integration type detected.');
        return;
    }

    switch (affiData.sdk) {
        case 'shopify':
            // Sets discount on checkout.
            await fetch(`/discount/${window.Afficone.referral}`);

            const body = new URLSearchParams();
            body.append('attributes[_ref]', window.Afficone.referral);

            await fetch(window.Shopify.routes.root + 'cart/update.js', {
                method: 'POST',
                body: body
            });

            break;
        case 'stripe': {
            stripeHandler();

            const observer = new MutationObserver((list, _) => {
                for (const m of list) {
                    for (let i = 0; i < m.addedNodes.length; i++) {
                        if (!m.addedNodes[i].tagName)
                            continue;

                        if (m.addedNodes[i].tagName.toLowerCase() === 'stripe-buy-button'
                            || m.addedNodes[i].tagName.toLowerCase() === 'stripe-pricing-table'
                            || m.addedNodes[i].href?.includes('https://buy.stripe.com')) {
                            stripeHandler();
                        }
                    }
                }
            });

            observer.observe(document.documentElement, {
                childList: true, subtree: true
            });
            break;
        }
        case 'paddle': {
            const observer = new MutationObserver((list, _) => {
                for (const { addedNodes } of list) {
                    for (let i = 0; i < addedNodes.length; i++) {
                        if (!addedNodes[i].tagName)
                            continue;

                        if (addedNodes[i].tagName.toLowerCase() === 'form') {
                            paddleHandler();
                        }
                    }
                }
            });

            observer.observe(document.documentElement, {
                childList: true, subtree: true
            });

            break;
        }
        case 'paypal': {
            paypalHandler();

            const observer = new MutationObserver((list, _) => {
                for (const { addedNodes } of list) {
                    for (let i = 0; i < addedNodes.length; i++) {
                        if (!addedNodes[i].tagName)
                            continue;
                    }
                }
            });

            observer.observe(document.documentElement, {
                childList: true, subtree: true
            });
            break;
        }
    }
}

function renderWidget() {
    if (affiData.widget.includedRoutes.length > 0 && !affiData.widget.includedRoutes.some(route => {
        const pattern = route.replace(/\*/g, '.*').replace(/\//g, '\\/');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(window.location.pathname);
    })) {
        return;
    }

    document.getElementById('affi-widget')?.remove();
    document.getElementById('affi-widget-css')?.remove();

    const link = document.createElement('link');
    link.id = 'affi-widget-css';
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.media = 'all';
    link.href = 'https://afficone.com/styles/widget.css';
    document.head.append(link);

    const widget = document.createElement('div');
    widget.id = 'affi-widget';
    widget.innerHTML = `<div class=affi-widget-title-container>{SVG_ICON}<p class=affi-widget-title>{TITLE}</div><p class=affi-widget-subtitle>{DESCRIPTION}</p><a class=affi-apply-button-container target='_blank' href={PORTAL_LINK}><button class=affi-apply-button>{BUTTON_TEXT}</button></a>`
        .replace('{SVG_ICON}', affiData.widget.svgIcon)
        .replace('{TITLE}', affiData.widget.title)
        .replace('{DESCRIPTION}', affiData.widget.description)
        .replace('{PORTAL_LINK}', affiData.portalUrl)
        .replace('{BUTTON_TEXT}', affiData.widget.buttonText);

    document.body.appendChild(widget);
}

async function conversion(order) {
    const ref = affiHelpers.getCookie(affiData.cookieName);
    if (ref == null) {
        return;
    }

    await fetch(`https://api.afficone.com/track/${affiData.token}/${ref}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(order)
    });
}

function paddleHandler() {
    const buttons = document.getElementsByClassName('paddle_button');

    for (let i = 0; i < buttons.length; i++) {
        const custom = buttons[i].getAttribute('data-custom-data') ?? '{}';
        const obj = JSON.parse(custom);

        obj._afficoneRef = window.Afficone.referral;
        buttons[i].setAttribute('data-custom-data', JSON.stringify(obj));
    }

    if (window.Paddle && window.Paddle.Checkout.afficone === undefined) {
        const orig = window.Paddle.Checkout.open;

        window.Paddle.Checkout.open = (props) => {
            console.log(`Debug: Paddle checkout patched, Afficone referral applied: ${window.Afficone.referral}`)
            orig({
                ...props,
                customData: {
                    ...props.customData,
                    _afficoneRef: window.Afficone.referral
                }
            });
        };

        window.Paddle.Checkout.afficone = true;
    }
}

function stripeHandler() {
    const links = document.getElementsByTagName('a');

    for (let i = 0; i < links.length; i++) {
        if (links[i].href.includes('https://buy.stripe.com')) {
            links[i].href = affiHelpers.appendStripeCri(links[i].href);
        }
    }

    const buttons = document.getElementsByTagName('stripe-buy-button');

    for (let i = 0; i < buttons.length; i++) {
        buttons[i].setAttribute('client-reference-id', window.Afficone.referral);
    }

    const pricingTables = document.getElementsByTagName('stripe-pricing-table');

    for (let i = 0; i < pricingTables.length; i++) {
        pricingTables[i].setAttribute('client-reference-id', window.Afficone.referral);
    }
}

function paypalHandler() {
    const forms = document.getElementsByTagName('form');

    for (let i = 0; i < forms.length; i++) {
        if (forms[i].action && typeof(forms[i].action) === 'string' &&
            forms[i].action.includes('paypal.com') &&
            forms[i].action.includes('/cgi-bin/webscr')) {

            console.log('paypal form - adding custom input')

            let input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'custom';
            input.value = window.Afficone.referral;
            forms[i].appendChild(input);
        }
    }

    const links = document.getElementsByTagName('a');
    for (let i = 0; i < links.length; i++) {
        if (links[i].href && links[i].href.includes('paypal.com') && links[i].href.includes('/cgi-bin/webscr')) {
            console.log('paypal link - adding custom param')
            let url = new URL(links[i].href);
            url.searchParams.append('custom', window.Afficone.referral);
            links[i].href = url.href;
        }
    }
}