import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { RouterModule } from '@angular/router';

import { JwtInterceptor } from './core/interceptors/jwt.interceptor';
import { ErrorInterceptor } from './core/interceptors/error.interceptor';

import { LayoutModule } from './layout/layout-module';
import { ParametreModule } from './features/parametre/parametre-module';
import { MaxPipePipe } from './shared/max-pipe-pipe';
import { ToastComponent } from './shared/components/toast/toast';

@NgModule({
  declarations: [
    App,
    MaxPipePipe,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    ReactiveFormsModule,
    RouterModule,
    LayoutModule,
    ParametreModule,
    ToastComponent
],
  providers: [
    provideBrowserGlobalErrorListeners(),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ErrorInterceptor,
      multi: true
    }
  ],
  bootstrap: [App]
})
export class AppModule { }
