import {
  ComponentOptions,
  PaymentComponent,
  PaymentComponentBuilder,
  PaymentMethod,
} from '../../../payment-enabler/payment-enabler';
import { BaseComponent } from '../../base';
import styles from '../../../style/style.module.scss';
import buttonStyles from '../../../style/button.module.scss';
import {
  PaymentOutcome,
  PaymentRequestSchemaDTO,
} from '../../../dtos/mock-payment.dto';
import { BaseOptions } from '../../../payment-enabler/payment-enabler-mock';

export class PrepaymentBuilder implements PaymentComponentBuilder {
  public componentHasSubmit = true;
  constructor(private baseOptions: BaseOptions) {}

  build(config: ComponentOptions): PaymentComponent {
    return new Prepayment(this.baseOptions, config);
  }
}

export class Prepayment extends BaseComponent {
  private showPayButton: boolean;
  private preloadData?: unknown;
  private buttonEl?: HTMLButtonElement;
  private container?: Element;

  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super(PaymentMethod.prepayment, baseOptions, componentOptions);
    this.showPayButton = componentOptions?.showPayButton ?? false;
  }

  mount(selector: string): void {
    // Guard against SSR / Node
    if (typeof document === 'undefined') {
      return;
    }

    this.container = document.querySelector(selector);
    if (!this.container) {
      return;
    }

    this.container.insertAdjacentHTML('afterbegin', this._getTemplate());

    // preload async
    this._preload().catch((err) => {
      console.error('Preload failed', err);
    });

    if (this.showPayButton) {
      this.buttonEl = this.container.querySelector(
        '#purchaseOrderForm-paymentButton'
      ) as HTMLButtonElement | null;

      if (this.buttonEl) {
        this.buttonEl.addEventListener('click', this._onPayClick);
      }
    }
  }

  private _onPayClick = (e: Event) => {
    e.preventDefault();
    this.submit().catch((err) => {
      this.onError(`Submit failed: ${(err as Error).message}`);
    });
  };

  private async _preload(): Promise<void> {
    const requestData: PaymentRequestSchemaDTO = {
      paymentMethod: { type: 'PREPAYMENT' },
      paymentOutcome: PaymentOutcome.AUTHORIZED,
    };

    try {
      const data = await this._doRequest('/v13', requestData);
      this.preloadData = data;
    } catch (err) {
      console.error('Error while preloading payment data', err);
    }
  }

  async submit(): Promise<void> {
    this.sdk.init({ environment: this.environment });

    const requestData: PaymentRequestSchemaDTO = {
      paymentMethod: { type: 'PREPAYMENT' },
      paymentOutcome: PaymentOutcome.AUTHORIZED,
    };

    try {
      const data = await this._doRequest('/payment', requestData);

      if (data?.paymentReference) {
        this.onComplete?.({
          isSuccess: true,
          paymentReference: data.paymentReference,
        });
      } else {
        this.onError('Some error occurred. Please try again.');
      }
    } catch (e) {
      this.onError('Some error occurred. Please try again.');
    }
  }

  private async _doRequest(
    endpoint: string,
    requestData: PaymentRequestSchemaDTO
  ): Promise<any> {
    const response = await fetch(this.processorUrl + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': this.sessionId,
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
  }

  private _getTemplate(): string {
    return this.showPayButton
      ? `
      <div class="${styles.wrapper}">
        <p>
          Pay easily with Prepayment and transfer the shopping amount within the
          specified date.
        </p>
        <button
          class="${buttonStyles.button} ${buttonStyles.fullWidth} ${styles.submitButton}"
          id="purchaseOrderForm-paymentButton"
        >
          Pay
        </button>
      </div>
    `
      : '';
  }

  destroy(): void {
    if (this.buttonEl) {
      this.buttonEl.removeEventListener('click', this._onPayClick);
      this.buttonEl = undefined;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = undefined;
    }
  }
}
