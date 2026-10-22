import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createQuoteFromOpportunity from '@salesforce/apex/RevquilaQuickActionController.createQuoteFromOpportunity';

export default class RevquilaQuickQuoteAction extends NavigationMixin(LightningElement) {
  @api recordId; // Opportunity ID passed by Salesforce Quick Action
  @track loading = false;

  async handleCreateQuote() {
    if (!this.recordId) return;

    this.loading = true;
    try {
      const res = await createQuoteFromOpportunity({ oppId: this.recordId });
      if (res && res.success && res.quoteId) {
        this.dispatchEvent(
          new ShowToastEvent({
            title: 'Quote Created',
            message: res.message || 'Fast quote successfully generated!',
            variant: 'success'
          })
        );

        // Redirect to Quote Record Page
        this[NavigationMixin.Navigate]({
          type: 'standard__recordPage',
          attributes: {
            recordId: res.quoteId,
            actionName: 'view'
          }
        });
      } else {
        this.dispatchEvent(
          new ShowToastEvent({
            title: 'Error',
            message: res.message || 'Failed to create quote.',
            variant: 'error'
          })
        );
      }
    } catch (err) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: 'Error',
          message: err.body?.message || err.message,
          variant: 'error'
        })
      );
    } finally {
      this.loading = false;
    }
  }

  handleCancel() {
    this.dispatchEvent(new CustomEvent('close'));
  }
}
