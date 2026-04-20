import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Partenaire, CreatePartenaireRequest } from '../models/partenaire';

@Injectable({
  providedIn: 'root',
})
export class PartenaireService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) { }

  getListePartenaires(): Observable<Partenaire[]> {
    return this.http.get<Partenaire[]>(
      `${this.apiUrl}/partenaire/liste-partenaire`
    );
  }

  createPartenaire(body: CreatePartenaireRequest): Observable<Partenaire> {
    const typeVal = body.type?.trim();
    const webhookVal = body.webhookUrl?.trim();
    const payload = {
      nom: String(body.nom ?? '').trim(),
      emailContact: String(body.emailContact ?? '').trim(),
      type: typeVal && typeVal.length > 0 ? typeVal : null,
      webhookUrl: webhookVal && webhookVal.length > 0 ? webhookVal : null,
      actif: body.actif === true,
    };
    return this.http.post(
      `${this.apiUrl}/partenaire/create-partenaire`,
      payload,
      { observe: 'response', responseType: 'text' }
    ).pipe(
      timeout(30000),
      map((res) => {
        if (res.body && res.body.trim().length > 0) {
          try {
            return JSON.parse(res.body) as Partenaire;
          } catch {
            return {} as Partenaire;
          }
        }
        return {} as Partenaire;
      })
    );
  }

  updatePartenaire(id: number, body: CreatePartenaireRequest): Observable<Partenaire> {
    const payload = {
      id,
      nom: body.nom,
      emailContact: body.emailContact,
      type: body.type?.trim() ? body.type.trim() : null,
      webhookUrl: body.webhookUrl?.trim() ? body.webhookUrl.trim() : null,
      actif: body.actif,
    };
    return this.http.put<Partenaire>(
      `${this.apiUrl}/partenaire/update-partenaire`,
      payload
    ).pipe(timeout(30000));
  }
}
