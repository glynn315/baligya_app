import { Component } from '@angular/core';
import { ComingSoonComponent } from '../../../shared/components/coming-soon.component';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [ComingSoonComponent],
  template: `
    <app-coming-soon
      title="Security & PIN"
      heading="Security settings coming soon"
      blurb="You'll soon be able to set a 4–6 digit PIN for fast cashier login, enable two-factor auth, and manage active sessions."
      iconName="lock-closed-outline">
    </app-coming-soon>
  `,
})
export class SecurityPage {}
