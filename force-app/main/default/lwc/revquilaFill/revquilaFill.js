import { brandProperties, loadConfig, onConfigChange } from "c/revquilaConfig";

const BRAND_PROPERTIES = [
  "--rq-brand-acc",
  "--rq-brand-acc-deep",
  "--rq-brand-acc2"
];

/**
 * Makes a component a full Revquila page. Call from connectedCallback with
 * this.template.host, and call the function it returns from disconnectedCallback.
 *
 * 1. Edge to edge: Lightning wraps a tab in a template with padding on every side.
 *    This cancels that padding. It is measured, not assumed, because it differs
 *    between Lightning themes; outside that template nothing is changed.
 * 2. Branded: the admin's accent colour (Setup > Branding) is put on the host, where
 *    revquilaTheme and every child component pick it up, and kept in step when it changes.
 */
export function fillPage(host) {
  const bleed = () => {
    const template = host.closest(".slds-template_default");
    if (!template) {
      return;
    }
    const { paddingTop, paddingRight, paddingBottom, paddingLeft } =
      getComputedStyle(template);
    host.style.margin = `-${paddingTop} -${paddingRight} -${paddingBottom} -${paddingLeft}`;
    host.style.minHeight = `calc(100% + ${paddingTop} + ${paddingBottom})`;
    host.classList.add("rq-bleed");
  };
  // Lightning can attach the page to its template after the component connects,
  // so measure whenever the host is laid out or resized rather than once here.
  const observer = new ResizeObserver(bleed);
  observer.observe(host);

  const brand = () => {
    const properties = brandProperties();
    BRAND_PROPERTIES.forEach((name) => {
      if (properties[name]) {
        host.style.setProperty(name, properties[name]);
      } else {
        host.style.removeProperty(name);
      }
    });
  };
  brand();
  const stopBrand = onConfigChange(brand);
  // A user who cannot read the configuration still gets the page, in the default colours
  loadConfig().catch(() => {});

  return () => {
    observer.disconnect();
    stopBrand();
  };
}