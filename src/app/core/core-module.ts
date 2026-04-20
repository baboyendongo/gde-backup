import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { UnauthorizedComponent } from './pages/unauthorized-component/unauthorized-component';



@NgModule({
  declarations: [
    
  ],
  imports: [
    CommonModule,
    UnauthorizedComponent,
    ReactiveFormsModule
  ]
})
export class CoreModule { }
