import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NavBar } from './nav-bar/nav-bar';
import { SideBar } from './side-bar/side-bar';

@NgModule({
  declarations: [
    NavBar
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SideBar
  ],
  exports: [
    NavBar,
    SideBar
  ]
})
export class LayoutModule {}
