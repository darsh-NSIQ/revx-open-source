import { LightningElement } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import LOGO from "@salesforce/resourceUrl/revquilaLogo";
import { getConfig, onConfigChange } from "c/revquilaConfig";
import { COMMAND_CENTER_PAGE } from "c/revquilaNav";

/**
 * The logo at the top of every custom page: the one uploaded in Setup > Branding,
 * or the Revquila logo. Clicking it goes to the Command Center.
 */
export default class RevquilaBrand extends NavigationMixin(LightningElement) {
  logoUrl = LOGO;

  _stop;

  connectedCallback() {
    this._stop = onConfigChange(() => this.useConfiguredLogo());
    this.useConfiguredLogo();
  }

  disconnectedCallback() {
    this._stop();
  }

  useConfiguredLogo() {
    this.logoUrl = getConfig().brand.logo || LOGO;
  }

  goHome() {
    this[NavigationMixin.Navigate](COMMAND_CENTER_PAGE);
  }
}