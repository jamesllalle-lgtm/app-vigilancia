import { Component, OnDestroy, ViewChild, ElementRef } from '@angular/core';
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
export class AppComponent implements OnDestroy {

  // Referencias al video y canvas del escaneo
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  // URLs de los backends
  readonly BACKEND_NET = 'http://10.1.37.62:5000';
  // readonly BACKEND_FLASK = 'http://10.1.37.62:5001';
  readonly BACKEND_FLASK = 'https://10.1.37.62:5001';

  // Estado general
  codigo: string = '';
  resultado: any = null;
  papeletas: any[] = [];
  cargando: boolean = false;
  buscado: boolean = false;
  tabActivo: string = 'dni';
  urlFoto: string = '';
  paginaActual: number = 1;
  porPagina: number = 5;

  // Estado escaneo
  escaneoStream: MediaStream | null = null;
  escaneoCamara: string = 'environment';
  escaneoCargando: boolean = false;
  escaneoBuscado: boolean = false;
  escaneoResultado: any = null;
  urlFotoEscaneo: string = '';

  constructor(private http: HttpClient) { }

  // =================== TABS ===================
  cambiarTab(tab: string) {
    this.tabActivo = tab;
    this.limpiar();

    if (tab === 'escaneo') {
      // Pequeño delay para que el DOM renderice el video
      setTimeout(() => this.iniciarCamara(), 200);
    } else {
      this.detenerCamara();
    }
  }

  // =================== BUSCAR (DNI / PAPELETAS) ===================
  buscar() {
    if (!this.codigo.trim()) return;
    this.cargando = true;
    this.buscado = false;
    this.resultado = null;
    this.papeletas = [];
    this.urlFoto = '';

    if (this.tabActivo === 'dni') {
      this.http.get(`${this.BACKEND_NET}/api/persona/dni/${this.codigo.trim()}`).subscribe({
        next: (data: any) => {
          this.resultado = data;
          if (data.encontrado) {
            this.urlFoto = `https://campus.uss.edu.pe/CampusNet4/imagenes/PerImagen.aspx?CPerCodigo=${data.dni}`;
          }
          this.cargando = false;
          this.buscado = true;
        },
        error: () => { this.cargando = false; this.buscado = true; }
      });

    } else if (this.tabActivo === 'papeletas') {
      this.http.get<any>(`${this.BACKEND_NET}/api/persona/dni/${this.codigo.trim()}`).subscribe({
        next: (persona: any) => {
          if (persona.encontrado) {
            this.urlFoto = `https://campus.uss.edu.pe/CampusNet4/imagenes/PerImagen.aspx?CPerCodigo=${persona.persona.codigo}`;
          }
          this.http.get<any[]>(`${this.BACKEND_NET}/api/papeletas/dni/${this.codigo.trim()}`).subscribe({
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

  // =================== CÁMARA ===================
  async iniciarCamara() {
    try {
      if (this.escaneoStream) {
        this.escaneoStream.getTracks().forEach(t => t.stop());
      }

      this.escaneoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.escaneoCamara,
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });

      const video = this.videoElement?.nativeElement;
      if (video) {
        video.srcObject = this.escaneoStream;

        // 🔑 CLAVE: esperar metadata y reproducir
        video.onloadedmetadata = () => {
          video.play().catch(err => {
            console.error('Error play video:', err);
          });
        };
      }

    } catch (err) {
      console.error('Error cámara:', err);
    }
  }

  detenerCamara() {
    if (this.escaneoStream) {
      this.escaneoStream.getTracks().forEach(t => t.stop());
      this.escaneoStream = null;
    }
  }

  cambiarCamara() {
    this.escaneoCamara = this.escaneoCamara === 'environment' ? 'user' : 'environment';
    this.iniciarCamara();
  }

  // =================== ESCANEAR ===================
  async escanear() {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return;

    this.escaneoCargando = true;

    try {
      const video = this.videoElement.nativeElement;
      const canvas = this.canvasElement.nativeElement;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);

      const blob: Blob = await new Promise(resolve =>
        canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.95)
      );

      const formData = new FormData();
      formData.append('imagen', blob, 'carnet.jpg');

      this.http.post<any>(`${this.BACKEND_FLASK}/escanear`, formData).subscribe({
        next: (data) => {
          console.log('RESPUESTA FLASK:', data); // 👈 AQUÍ

          this.escaneoResultado = data;
          this.escaneoBuscado = true;
          this.escaneoCargando = false;
          this.detenerCamara();

          if (data.encontrado && data.dni) {
            this.urlFotoEscaneo =
              `https://campus.uss.edu.pe/CampusNet4/imagenes/PerImagen.aspx?CPerCodigo=${data.persona?.codigo}`;
          }
        },
        error: () => {
          this.escaneoResultado = {
            encontrado: false,
            esTrabajador: false,
            mensaje: '❌ No se pudo conectar con el servidor de escaneo'
          };
          this.escaneoBuscado = true;
          this.escaneoCargando = false;
        }
      });

    } catch (err) {
      console.error('Error escaneo:', err);
      this.escaneoCargando = false;
    }
  }

  limpiarEscaneo() {
    this.escaneoBuscado = false;
    this.escaneoResultado = null;
    this.urlFotoEscaneo = '';
    setTimeout(() => this.iniciarCamara(), 200);
  }

  // =================== HELPERS ===================
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

  ngOnDestroy() {
    this.detenerCamara();
  }
}