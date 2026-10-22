import { LightningElement, track } from 'lwc';
import getWorkspaceData from '@salesforce/apex/RevquilaEnterpriseTrustController.getWorkspaceData';
import getAuditTrail from '@salesforce/apex/RevquilaEnterpriseTrustController.getAuditTrail';
import getQuoteVersions from '@salesforce/apex/RevquilaEnterpriseTrustController.getQuoteVersions';
import snapshotQuote from '@salesforce/apex/RevquilaEnterpriseTrustController.snapshotQuote';
import compareQuoteVersions from '@salesforce/apex/RevquilaEnterpriseTrustController.compareQuoteVersions';
import restoreQuoteVersion from '@salesforce/apex/RevquilaEnterpriseTrustController.restoreQuoteVersion';
import saveCommissionPlan from '@salesforce/apex/RevquilaEnterpriseTrustController.saveCommissionPlan';
import getStatementDetail from '@salesforce/apex/RevquilaEnterpriseTrustController.getStatementDetail';
import approveCommissionStatement from '@salesforce/apex/RevquilaEnterpriseTrustController.approveCommissionStatement';
import payCommissionStatement from '@salesforce/apex/RevquilaEnterpriseTrustController.payCommissionStatement';

export default class RevquilaEnterpriseTrust extends LightningElement {
    @track activeTab = 'audit'; // audit, commissions, versioning, rbac
    @track isLoading = false;
    @track errorMessage = '';
    @track successMessage = '';

    // Workspace & Permissions
    @track permissions = {};
    @track totalAuditEvents = 0;
    @track activePlanCount = 0;
    @track totalCommissionsPaid = 0;
    @track totalCommissionsPending = 0;

    // Sub-tab: Audit Trail
    @track auditEntries = [];
    @track auditEventTypeFilter = 'All';
    @track auditObjectFilter = 'All';
    @track auditSearchTerm = '';
    @track selectedAuditEntry = null;

    // Sub-tab: Commissions
    @track plans = [];
    @track statements = [];
    @track selectedStatementDetail = null;
    @track showNewPlanModal = false;
    @track newPlan = {
        Name: '',
        Period_Type__c: 'Quarterly',
        Trigger_Event__c: 'Quote Won',
        Base_Rate__c: 8.0,
        Quota_Target__c: 100000,
        Tier_1_Threshold__c: 50000,
        Tier_1_Rate__c: 10.0,
        Tier_2_Threshold__c: 100000,
        Tier_2_Rate__c: 12.0,
        Accelerated_Rate__c: 15.0,
        Description__c: '',
        Active__c: true
    };

    // Sub-tab: Quote Versioning
    @track quotes = [];
    @track selectedQuoteId = '';
    @track versions = [];
    @track versionAId = '';
    @track versionBId = '';
    @track comparisonResult = null;
    @track showSnapshotModal = false;
    @track snapshotReason = '';

    connectedCallback() {
        this.loadWorkspace();
    }

    async loadWorkspace() {
        this.isLoading = true;
        this.errorMessage = '';
        try {
            const data = await getWorkspaceData();
            this.permissions = data.permissions || {};
            this.plans = data.plans || [];
            this.statements = data.statements || [];
            this.auditEntries = data.auditEntries || [];
            this.totalAuditEvents = data.totalAuditEvents || 0;
            this.activePlanCount = data.activePlanCount || 0;
            this.totalCommissionsPaid = data.totalCommissionsPaid || 0;
            this.totalCommissionsPending = data.totalCommissionsPending || 0;
            this.quotes = data.quotes || [];

            if (this.quotes.length > 0 && !this.selectedQuoteId) {
                this.selectedQuoteId = this.quotes[0].id;
                this.loadVersionsForQuote(this.selectedQuoteId);
            }
        } catch (error) {
            this.errorMessage = error?.body?.message || error?.message || 'Error loading enterprise trust data';
        } finally {
            this.isLoading = false;
        }
    }

    // Tab Navigation
    handleTabSelect(event) {
        this.activeTab = event.currentTarget.dataset.tab;
        this.errorMessage = '';
        this.successMessage = '';
    }

    get isAuditTab() { return this.activeTab === 'audit'; }
    get isCommissionsTab() { return this.activeTab === 'commissions'; }
    get isVersioningTab() { return this.activeTab === 'versioning'; }
    get isRbacTab() { return this.activeTab === 'rbac'; }

    get tabAuditClass() { return this.activeTab === 'audit' ? 'nav-tab-btn active' : 'nav-tab-btn'; }
    get tabCommissionsClass() { return this.activeTab === 'commissions' ? 'nav-tab-btn active' : 'nav-tab-btn'; }
    get tabVersioningClass() { return this.activeTab === 'versioning' ? 'nav-tab-btn active' : 'nav-tab-btn'; }
    get tabRbacClass() { return this.activeTab === 'rbac' ? 'nav-tab-btn active' : 'nav-tab-btn'; }

    // Audit Trail Helpers
    handleAuditFilterChange(event) {
        const field = event.target.dataset.filter;
        if (field === 'event') this.auditEventTypeFilter = event.target.value;
        if (field === 'object') this.auditObjectFilter = event.target.value;
        if (field === 'search') this.auditSearchTerm = event.target.value.toLowerCase();
    }

    get filteredAuditEntries() {
        return this.auditEntries.filter(entry => {
            const matchesEvent = this.auditEventTypeFilter === 'All' || entry.Event_Type__c === this.auditEventTypeFilter;
            const matchesObject = this.auditObjectFilter === 'All' || entry.Object_Api_Name__c === this.auditObjectFilter;
            const matchesSearch = !this.auditSearchTerm ||
                (entry.Record_Name__c && entry.Record_Name__c.toLowerCase().includes(this.auditSearchTerm)) ||
                (entry.User_Name__c && entry.User_Name__c.toLowerCase().includes(this.auditSearchTerm)) ||
                (entry.Action__c && entry.Action__c.toLowerCase().includes(this.auditSearchTerm));
            return matchesEvent && matchesObject && matchesSearch;
        });
    }

    handleViewAuditDetail(event) {
        const id = event.currentTarget.dataset.id;
        this.selectedAuditEntry = this.auditEntries.find(e => e.Id === id) || null;
    }

    handleCloseAuditModal() {
        this.selectedAuditEntry = null;
    }

    exportAuditCsv() {
        const headers = ['Timestamp', 'Event Type', 'Record', 'Object', 'Action', 'User', 'Reason'];
        const rows = this.filteredAuditEntries.map(e => [
            `"${e.Timestamp__c || ''}"`,
            `"${e.Event_Type__c || ''}"`,
            `"${e.Record_Name__c || ''}"`,
            `"${e.Object_Api_Name__c || ''}"`,
            `"${e.Action__c || ''}"`,
            `"${e.User_Name__c || ''}"`,
            `"${e.Reason__c || ''}"`
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `revx_audit_log_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Commission Helpers
    async handleViewStatementDetail(event) {
        const id = event.currentTarget.dataset.id;
        this.isLoading = true;
        try {
            this.selectedStatementDetail = await getStatementDetail({ statementId: id });
        } catch (error) {
            this.errorMessage = error?.body?.message || error?.message || 'Error loading statement';
        } finally {
            this.isLoading = false;
        }
    }

    handleCloseStatementModal() {
        this.selectedStatementDetail = null;
    }

    async handleApproveStatement(event) {
        const id = event.currentTarget.dataset.id;
        this.isLoading = true;
        try {
            await approveCommissionStatement({ statementId: id });
            this.successMessage = 'Commission statement approved successfully!';
            await this.loadWorkspace();
            if (this.selectedStatementDetail && this.selectedStatementDetail.statement.Id === id) {
                this.selectedStatementDetail = await getStatementDetail({ statementId: id });
            }
        } catch (error) {
            this.errorMessage = error?.body?.message || error?.message || 'Approval failed';
        } finally {
            this.isLoading = false;
        }
    }

    async handlePayStatement(event) {
        const id = event.currentTarget.dataset.id;
        this.isLoading = true;
        try {
            await payCommissionStatement({ statementId: id, paymentDate: null });
            this.successMessage = 'Commission statement marked as Paid!';
            await this.loadWorkspace();
            if (this.selectedStatementDetail && this.selectedStatementDetail.statement.Id === id) {
                this.selectedStatementDetail = await getStatementDetail({ statementId: id });
            }
        } catch (error) {
            this.errorMessage = error?.body?.message || error?.message || 'Disbursement failed';
        } finally {
            this.isLoading = false;
        }
    }

    handleOpenNewPlanModal() {
        this.showNewPlanModal = true;
    }

    handleCloseNewPlanModal() {
        this.showNewPlanModal = false;
    }

    handlePlanFieldChange(event) {
        const field = event.target.dataset.field;
        this.newPlan = { ...this.newPlan, [field]: event.target.value };
    }

    async handleSavePlan() {
        if (!this.newPlan.Name) {
            this.errorMessage = 'Plan name is required.';
            return;
        }
        this.isLoading = true;
        try {
            await saveCommissionPlan({ plan: this.newPlan });
            this.successMessage = 'Commission plan created successfully!';
            this.showNewPlanModal = false;
            await this.loadWorkspace();
        } catch (error) {
            this.errorMessage = error?.body?.message || error?.message || 'Error saving plan';
        } finally {
            this.isLoading = false;
        }
    }

    // Quote Versioning Helpers
    async handleQuoteSelect(event) {
        this.selectedQuoteId = event.target.value;
        await this.loadVersionsForQuote(this.selectedQuoteId);
    }

    async loadVersionsForQuote(quoteId) {
        if (!quoteId) return;
        this.isLoading = true;
        try {
            this.versions = await getQuoteVersions({ quoteId });
            if (this.versions.length >= 2) {
                this.versionAId = this.versions[1].Id;
                this.versionBId = this.versions[0].Id;
                await this.executeComparison();
            } else if (this.versions.length === 1) {
                this.versionAId = this.versions[0].Id;
                this.versionBId = this.versions[0].Id;
                this.comparisonResult = null;
            } else {
                this.comparisonResult = null;
            }
        } catch (error) {
            this.errorMessage = error?.body?.message || error?.message || 'Error loading quote versions';
        } finally {
            this.isLoading = false;
        }
    }

    handleVersionASelect(event) {
        this.versionAId = event.target.value;
        this.executeComparison();
    }

    handleVersionBSelect(event) {
        this.versionBId = event.target.value;
        this.executeComparison();
    }

    async executeComparison() {
        if (!this.versionAId || !this.versionBId) return;
        this.isLoading = true;
        try {
            this.comparisonResult = await compareQuoteVersions({
                versionAId: this.versionAId,
                versionBId: this.versionBId
            });
        } catch (error) {
            this.errorMessage = error?.body?.message || error?.message || 'Comparison failed';
        } finally {
            this.isLoading = false;
        }
    }

    handleOpenSnapshotModal() {
        this.snapshotReason = '';
        this.showSnapshotModal = true;
    }

    handleCloseSnapshotModal() {
        this.showSnapshotModal = false;
    }

    handleSnapshotReasonChange(event) {
        this.snapshotReason = event.target.value;
    }

    async handleCreateSnapshot() {
        if (!this.selectedQuoteId) return;
        this.isLoading = true;
        try {
            await snapshotQuote({ quoteId: this.selectedQuoteId, reason: this.snapshotReason });
            this.successMessage = 'Quote snapshot created successfully!';
            this.showSnapshotModal = false;
            await this.loadVersionsForQuote(this.selectedQuoteId);
            await this.loadWorkspace();
        } catch (error) {
            this.errorMessage = error?.body?.message || error?.message || 'Snapshot creation failed';
        } finally {
            this.isLoading = false;
        }
    }

    async handleRestoreVersion(event) {
        const versionId = event.currentTarget.dataset.id;
        if (!confirm('Are you sure you want to revert this quote to this snapshot? Existing draft lines will be replaced.')) {
            return;
        }
        this.isLoading = true;
        try {
            await restoreQuoteVersion({ quoteId: this.selectedQuoteId, versionId });
            this.successMessage = 'Quote reverted back to snapshot successfully!';
            await this.loadVersionsForQuote(this.selectedQuoteId);
            await this.loadWorkspace();
        } catch (error) {
            this.errorMessage = error?.body?.message || error?.message || 'Restoration failed';
        } finally {
            this.isLoading = false;
        }
    }

    get eventFilterOptions() {
        return [
            { label: 'All Events', value: 'All' },
            { label: 'Pricing Change', value: 'Pricing Change' },
            { label: 'Discount Override', value: 'Discount Override' },
            { label: 'Approval Action', value: 'Approval Action' },
            { label: 'Period Lock', value: 'Period Lock' },
            { label: 'Period Reopen', value: 'Period Reopen' },
            { label: 'Refund Issued', value: 'Refund Issued' },
            { label: 'Commission Action', value: 'Commission Action' },
            { label: 'Quote Restored', value: 'Quote Restored' }
        ];
    }

    get objectFilterOptions() {
        return [
            { label: 'All Objects', value: 'All' },
            { label: 'Quote__c', value: 'Quote__c' },
            { label: 'Revenue_Period_Lock__c', value: 'Revenue_Period_Lock__c' },
            { label: 'Payment__c', value: 'Payment__c' },
            { label: 'Commission_Plan__c', value: 'Commission_Plan__c' },
            { label: 'Commission_Statement__c', value: 'Commission_Statement__c' }
        ];
    }

    get periodTypeOptions() {
        return [
            { label: 'Monthly', value: 'Monthly' },
            { label: 'Quarterly', value: 'Quarterly' },
            { label: 'Annual', value: 'Annual' }
        ];
    }

    get triggerEventOptions() {
        return [
            { label: 'Quote Won', value: 'Quote Won' },
            { label: 'Invoice Paid', value: 'Invoice Paid' }
        ];
    }

    get hasVersions() { return this.versions && this.versions.length > 0; }
    get canCompare() { return this.versions && this.versions.length >= 2; }
    get hasComparisonResult() { return this.comparisonResult !== null; }
    get hasLineDiffs() { return this.comparisonResult && this.comparisonResult.lineDiffs && this.comparisonResult.lineDiffs.length > 0; }
    get hasHeaderDiffs() { return this.comparisonResult && this.comparisonResult.headerDiffs && this.comparisonResult.headerDiffs.length > 0; }
}
