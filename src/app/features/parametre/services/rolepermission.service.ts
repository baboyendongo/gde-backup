import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Role } from '../models/role';

@Injectable({
  providedIn: 'root',
})
export class RolePermissionService {
  private readonly apiUrl = `${environment.apiUrl}/rolepermission`;

  constructor(private readonly http: HttpClient) { }

  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/liste-role`);
  }

  assignUserRole(username: string, roleNoms: string[]): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/assign-user-role`,
      { username, roleNoms },
      { headers: { 'Content-Type': 'application/json' }, responseType: 'text' }
    );
  }

  deleteUserRole(username: string, roleNames: string[]): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${username}/remove-user-roles`, {
      body: { username, roleNames },
      headers: { 'Content-Type': 'application/json' },
      responseType: 'text'
    });
  }
}