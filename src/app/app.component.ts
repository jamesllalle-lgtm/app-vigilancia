import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  codigo: string = '';
  resultado: any = null;
  papeletas: any[] = [];
  cargando: boolean = false;
  buscado: boolean = false;
  tabActivo: string = 'codigo';
  urlFoto: string = '';
paginaActual: number = 1;
porPagina: number = 5;
  constructor(private http: HttpClient) {}

  cambiarTab(tab: string) {
    this.tabActivo = tab;
    this.limpiar();
  }

  buscar() {
    if (!this.codigo.trim()) return;
    this.cargando = true;
    this.buscado = false;
    this.resultado = null;
    this.papeletas = [];
    this.urlFoto = '';

    if (this.tabActivo === 'codigo') {
      this.http.get(`http://10.1.37.62:5000/api/persona/${this.codigo.trim()}`).subscribe({
        next: (data: any) => {
          this.resultado = data;
          if (data.encontrado) {
            this.urlFoto = `https://campus.uss.edu.pe/CampusNet4/imagenes/PerImagen.aspx?CPerCodigo=${data.persona.codigo}`;
          }
          this.cargando = false;
          this.buscado = true;
        },
        error: () => { this.cargando = false; this.buscado = true; }
      });

    } else if (this.tabActivo === 'dni') {
      this.http.get(`http://10.1.37.62:5000/api/persona/dni/${this.codigo.trim()}`).subscribe({
        next: (data: any) => {
          this.resultado = data;
          if (data.encontrado) {
            this.urlFoto = `https://campus.uss.edu.pe/CampusNet4/imagenes/PerImagen.aspx?CPerCodigo=${data.persona.codigo}`;
          }
          this.cargando = false;
          this.buscado = true;
        },
        error: () => { this.cargando = false; this.buscado = true; }
      });

  } else if (this.tabActivo === 'papeletas') {
  // Primero obtenemos el codigo de persona por DNI
  this.http.get<any>(`http://10.1.37.62:5000/api/persona/dni/${this.codigo.trim()}`).subscribe({
    next: (persona: any) => {
      if (persona.encontrado) {
        this.urlFoto = `https://campus.uss.edu.pe/CampusNet4/imagenes/PerImagen.aspx?CPerCodigo=${persona.persona.codigo}`;
      }
      // Luego obtenemos las papeletas
      this.http.get<any[]>(`http://10.1.37.62:5000/api/papeletas/dni/${this.codigo.trim()}`).subscribe({
        next: (data: any[]) => {
          this.papeletas = data;
          this.paginaActual = 1;
          this.cargando = false;
          this.buscado = true;
        },
        error: () => { this.cargando = false; this.buscado = true; }
      });
    },
    error: () => { this.cargando = false; this.buscado = true; }
  });
}
  }

  limpiar() {
    this.codigo = '';
    this.resultado = null;
    this.papeletas = [];
    this.buscado = false;
    this.urlFoto = '';
  }

  onFotoError(event: any) {
    event.target.style.display = 'none';
  }

  getEstadoClass(estado: string): string {
    if (estado === 'Autorizado') return 'estado-autorizado';
    if (estado === 'Denegado') return 'estado-denegado';
    return 'estado-pendiente';
  }

  get papeletasPaginadas(): any[] {
  const inicio = (this.paginaActual - 1) * this.porPagina;
  return this.papeletas.slice(inicio, inicio + this.porPagina);
}

get totalPaginas(): number {
  return Math.ceil(this.papeletas.length / this.porPagina);
}

cambiarPagina(pagina: number) {
  this.paginaActual = pagina;
}
}