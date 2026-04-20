import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ParametreRoutingModule } from './parametre-routing-module';
import { DetailUser } from './page/detail-user/detail-user';


@NgModule({
  declarations: [
    DetailUser
  ],
  imports: [
    CommonModule,
    ParametreRoutingModule
  ]
})
export class ParametreModule { }
