"""Python calculation backend for the Steel Member Design Check webpage."""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "assets" / "tools"
with (ASSETS / "steel-section-database.json").open(encoding="utf-8") as f:
    SECTION_DB = json.load(f)
with (ASSETS / "steel-ltb-tables.json").open(encoding="utf-8") as f:
    LTB = json.load(f)

app = FastAPI(title="Steel Member Design API", version="1.0.0")
origins = [x.strip() for x in os.getenv("STEEL_API_CORS_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type"])

class DesignInputError(ValueError):
    pass

def num(data: dict[str, Any], key: str) -> float:
    try:
        value = float(data[key])
    except (KeyError, TypeError, ValueError):
        raise DesignInputError(f"Enter a valid number for {key}.") from None
    if not math.isfinite(value):
        raise DesignInputError(f"Enter a finite number for {key}.")
    return value

def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))

def classify(s: dict[str, Any], fy: float, v: dict[str, float]) -> dict[str, int | float]:
    eps = math.sqrt(235 / fy)
    A, h, width = s["A[cm2]"], s["h[mm]"], s["b[mm]"]
    tw, tf, radius = s["tw[mm]"], s["tf[mm]"], s["r1[mm]"]
    cw, cf = h - 2 * tf - 2 * radius, width / 2 - radius - tf / 2
    N, My, Mz, gm = v["N"], v["My"], v["Mz"], v["gm0"]
    wy, wz, iz = s["Wy[cm3]"], s["Wz[cm3]"], s["Iz[cm4]"]
    def adj(stress: float) -> float:
        return eps + math.sqrt(fy / (gm * stress)) if stress > 0 else eps
    def classify_plate(slenderness: float, a: float, b: float, c: float, d: float) -> int:
        return 1 if slenderness <= a else 2 if slenderness <= b else 3 if slenderness <= c or slenderness <= d else 4
    top = N * 10 / A + abs(My) * 1000 / wy
    bottom = N * 10 / A - abs(My) * 1000 / wy
    compression = max(top, bottom)
    if N == 0 and My != 0:
        c1, c2, c3, c3a = 72*eps, 83*eps, 121*eps, 121*adj(compression)
    elif N > 0 and My == 0:
        c1, c2, c3, c3a = 28*eps, 34*eps, 38*eps, 38*adj(compression)
    elif N < 0:
        c1, c2, c3, c3a = 72*eps, 83*eps, 121*eps, 121*adj(compression)
    elif N != 0 and My != 0:
        alpha = clamp(0.5 * (1 + N / max(1e-9, cw * tw * fy)))
        c1 = 126*eps/(5.5*alpha-1) if alpha > .5 else 36*eps/max(alpha, 1e-9)
        c2 = 188*eps/(6.53*alpha-1) if alpha > .5 else 41.5*eps/max(alpha, 1e-9)
        psi = bottom/top if top else 1
        fac = 38/(.608+.343*psi+.049*psi**2) if psi > -1 else 60.5*(1-psi)
        c3, c3a = fac*eps, fac*adj(compression)
    else:
        c1, c2, c3, c3a = 72*eps, 83*eps, 121*eps, 121*eps
    web = classify_plate(cw/tw, c1, c2, c3, c3a)
    def flange(tip: int) -> int:
        extreme = N*10/A + abs(My)*1000/wy + tip*abs(Mz)*1000/wz
        near = N*10/A + abs(My)*1000/wy + tip*abs(Mz)*100*(radius+.5*tw)/iz
        if (N > 0 or My != 0) and Mz == 0:
            a,b,c = 9*eps,10*eps,14*eps
            d = 14*adj(max(extreme,near))
        else:
            limit = max(1e-9, cf*tf*fy)
            nt = N + My/max(1,h-tf) + abs(Mz)/(width/2)*tip
            ac = clamp(.5*(1+nt/limit))
            a,b = 9*eps/max(ac,1e-9),10*eps/max(ac,1e-9)
            psi = near/extreme if tip == 1 and extreme else extreme/near if near else 1
            ks = (4 if psi == 1 else 8.2/(1.05+psi) if psi > 0 else 7.81 if psi == 0 else 7.81-6.29*psi+9.78*psi**2 if psi > -1 else 23.9 if psi == -1 else 5.98*(1-psi)**2 if psi >= -3 else 95.68)
            c,d = 21*eps*math.sqrt(ks),21*adj(max(extreme,near))*math.sqrt(ks)
        return classify_plate(cf/tf,a,b,c,d)
    f1,f2 = flange(1),flange(-1)
    return {"web":web,"flange":max(f1,f2),"overall":max(web,f1,f2),"epsilon":eps}

def buckling(s: dict[str, Any], fy: float, axis: str, grade: str, v: dict[str,float]) -> dict[str,Any]:
    ratio,tf=s["h[mm]"]/s["b[mm]"],s["tf[mm]"]
    curve=("a" if axis=="y" else "b") if ratio>1.2 and tf<=40 else ("b" if axis=="y" else "c") if ratio>1.2 else ("b" if axis=="y" else "c") if tf<=100 else "d"
    if grade in {"S460","S500","S550","S600","S650","S700"}: curve={"a":"a0","b":"a","c":"b","d":"c"}.get(curve,curve)
    alpha={"a0":.13,"a":.21,"b":.34,"c":.49,"d":.76}[curve]
    i=s["iy[mm]"] if axis=="y" else s["iz[mm]"]
    length=v["Lcry"] if axis=="y" else v["Lcrz"]
    lam=length*1000/i/(math.pi*math.sqrt(210000/fy))
    phi=.5*(1+alpha*(lam-.2)+lam**2)
    chi=min(1,1/(phi+math.sqrt(max(0,phi**2-lam**2))))
    return {"curve":curve,"alpha":alpha,"lambda":lam,"chi":chi,"Nb":chi*s["A[cm2]"]*fy*.1/v["gm1"]}

def reduction_points(alpha: float, coupled: float | None) -> list[list[float]]:
    pts=[]
    for i in range(101):
        x=i*.03
        phi=.5*(1+alpha*(x-.2)+x*x) if coupled is None else .5*(1+(x/coupled)**2*alpha*(coupled-.2)+x*x)
        pts.append([x,min(1,1/(phi+math.sqrt(max(0,phi*phi-x*x))))])
    return pts

def bracket(axis: list[float], x: float) -> int:
    i=0
    while i<len(axis)-2 and x>axis[i+1]: i+=1
    return i

def bilinear(mu: float, kl: float, case_no: int, loc: str) -> float:
    mu_axis=LTB["mu_values"] if case_no==2 else LTB["mu_value_case5"] if case_no==5 else LTB["mu_values_case3"]
    kl_axis=[0,1,2,3,4,6,8,10,15,20]
    suffix="topflange" if loc=="topflange" else "bottomflange" if loc=="bottomflange" else "middle"
    table=LTB.get(f"m{case_no}_table_{suffix}")
    if table is None: raise DesignInputError("Mcr table data is missing for the selected case.")
    mu=max(mu_axis[0],min(mu_axis[-1],mu));kl=max(0,min(20,kl))
    i,j=bracket(mu_axis,mu),bracket(kl_axis,kl)
    u=(mu-mu_axis[i])/(mu_axis[i+1]-mu_axis[i]);w=(kl-kl_axis[j])/(kl_axis[j+1]-kl_axis[j])
    return table[i][j]*(1-u)*(1-w)+table[i+1][j]*u*(1-w)+table[i][j+1]*(1-u)*w+table[i+1][j+1]*u*w

def mcr_from_case(s:dict[str,Any],v:dict[str,float],case_no:int,loc:str)->float:
    E,G,L=210000.,81000.,v["LcrLT"]*1000
    iz,it,iw=s["Iz[cm4]"]*1e4,s["It[cm4]"]*1e4,s["Iω[cm6]"]*1e6
    ht=s["h[mm]"]-s["tf[mm]"];kl=math.sqrt(G*it*L*L/(E*iw));mu=v["mu"]
    max_mu={2:.25,3:1/6,4:1/6,5:.125}[case_no]
    if not 0<=mu<=max_mu: raise DesignInputError(f"For load case {case_no}, μ must be between 0 and {max_mu}.")
    q=E*iz/L**2*ht*bilinear(mu,kl,case_no,loc)
    critical=(max(abs(q/4-.5*q*mu),q*mu) if case_no==2 else max(abs(q/4-q*mu),q*mu) if case_no==3 else max(abs(q/8-.5*q*mu),q*mu) if case_no==4 else max(abs(q/8-q*mu),q*mu))
    return critical/1e6

def moment_factor(shape:int,psi:float,alpha:float,load:str)->float:
    if shape==1:return max(.6+.4*psi,.4)
    if shape in (2,3) and not(-1<alpha<1 and -1<psi<1):
        name="alpha_s" if shape==2 else "alpha_h"
        raise DesignInputError(f"Invalid inputs. Choose -1 < {name} < 1, -1 < psi < 1")
    if shape==2:
        if alpha>=0:return max(.2+.8*alpha,.4)
        if load=="Uniform":return max(.1-.8*alpha if psi>=0 else .1*(1-psi)-.8*alpha,.4)
        return max(-.8*alpha if psi>=0 else -.2*psi-.8*alpha,.4)
    if shape==3:
        base,slope=(.95,.05) if load=="Uniform" else (.9,.1)
        return base+slope*alpha*(1+2*psi if alpha<0 and psi<0 else 1)
    raise DesignInputError("Invalid equivalent moment shape.")

def interaction(ny:float,nz:float,cy:float,cz:float,clt:float,ly:float,lz:float,cls:int)->dict[str,float]:
    plastic=cls<=3
    kyy=cy*(1+(ly-.2 if ly<1 else .8)*ny) if plastic else cy*(1+.6*min(ly,1)*ny)
    if plastic:
        kzy=min(1-.1*lz*nz/(clt-.25),.6+lz) if lz<1 and lz<.4 else 1-.1*lz*nz/(clt-.25) if lz<1 else 1-.1*nz/(clt-.25)
    else:kzy=1-.05*lz*nz/(clt-.25) if lz<1 else 1-.05*nz/(clt-.25)
    kzz=cz*(1+(2*lz-.6 if lz<1 else 1.4)*nz) if plastic else cz*(1+.6*min(lz,1)*nz)
    return {"kyy":kyy,"kyz":(.6 if plastic else 1)*kzz,"kzy":kzy,"kzz":kzz}

def calculate_design(p:dict[str,Any])->dict[str,Any]:
    fields=["N","My","Mz","Vz","Vy","T","B","hole","kfactor","gm0","gm1","gm2","Lcry","Lcrz","LcrT","dz","LcrLT","Mcr","mu","psiY","alphaY","psiZ","alphaZ","psiLT","alphaLT"]
    v={key:num(p,key) for key in fields}
    if v["N"]==0 and v["My"]==0 and v["Mz"]==0:
        raise DesignInputError("The section classification needs a non-zero axial force N_Ed or a non-zero bending moment M_Edy and M_Edz.")
    series_index=int(p.get("seriesIndex",0))
    if not 0<=series_index<len(SECTION_DB["series"]):raise DesignInputError("Choose a valid section series.")
    series=SECTION_DB["series"][series_index]
    section=next((x for x in series["sections"] if x["name"]==str(p.get("sectionName",""))),None)
    if section is None:raise DesignInputError("Choose a valid steel section.")
    grade=str(p.get("grade",""))
    strengths={"S235":(235,360,215,360),"S275":(275,390,245,370),"S355":(355,490,325,470),"S420":(420,510,390,490),"S460":(460,540,410,510),"S500":(500,580,450,580),"S550":(550,600,500,600),"S600":(600,650,550,650),"S620":(620,700,560,660),"S650":(650,700,None,None),"S690":(690,770,630,710),"S700":(700,750,None,None)}
    if grade not in strengths:raise DesignInputError("Choose a supported steel grade.")
    fy,fu=(strengths[grade][2:4] if max(section["tw[mm]"],section["tf[mm]"])>40 and max(section["tw[mm]"],section["tf[mm]"])<=80 else strengths[grade][:2])
    if fy is None:raise DesignInputError(f"{grade} has no tabulated strength above 40 mm in the supplied Python procedure.")
    mat={"fy":fy,"fu":fu}
    area=section["A[cm2]"];net_area=area-v["hole"]
    if net_area<=0:raise DesignInputError("Hole area must be smaller than the gross section area.")
    if not 0<v["kfactor"]<=1:raise DesignInputError("Net section factor k must be greater than zero and no more than 1.")
    if any(v[k]<=0 for k in ("Lcry","Lcrz","LcrT","LcrLT")):raise DesignInputError("All buckling lengths must be greater than zero.")
    gm0,gm1,gm2=v["gm0"],v["gm1"],v["gm2"]
    if min(gm0,gm1,gm2)<=0:raise DesignInputError("Partial safety factors must be greater than zero.")
    E,G=210000.,81000.
    nrd=area*fy*.1/gm0; nurd=v["kfactor"]*net_area*fu*.1/gm2
    myrd=section["Wpl,y[cm3]"]*fy*.001/gm0; mzrd=section["Wpl,z[cm3]"]*fy*.001/gm0
    shear_area=max(area*100-2*section["b[mm]"]*section["tf[mm]"]+(section["tw[mm]"]+2*section["r1[mm]"])*section["tf[mm]"],(section["h[mm]"]-2*section["tf[mm]"])*section["tw[mm]"])
    vpl=shear_area*fy/math.sqrt(3)/gm0*.001
    tau=abs(v["T"])*section["tw[mm]"]/section["It[cm4]"]*100
    term=1-tau/(1.25*(fy/math.sqrt(3))/gm0)
    if term<0:raise DesignInputError("Torsional shear exceeds the range supported by the supplied plastic shear interaction equation.")
    vpl_t=math.sqrt(term)*vpl
    fby=buckling(section,fy,"y",grade,v); fbz=buckling(section,fy,"z",grade,v)
    iw=section["Iω[cm6]"]*1e6; it=section["It[cm4]"]*1e4; amm=area*100
    iy=section["Iy[cm4]"]*1e4; iz=section["Iz[cm4]"]*1e4; ip=section["ip[mm]"]
    ic2=section["yc[mm]"]**2+(iy+iz)/amm; lt=v["LcrT"]*1000; lz=v["Lcrz"]*1000
    ncrz=math.pi**2*E*iz/lz**2/1000; ncrt=(G*it+math.pi**2*E*iw/lt**2)/ic2/1000
    npl=amm*fy/1000; lambda_t=math.sqrt(npl/ncrt); lambda_z=math.sqrt(npl/ncrz)
    hbr=section["h[mm]"]/section["b[mm]"]
    curve_t=("b" if section["tf[mm]"]<=40 else "c") if hbr>1.2 else ("c" if section["tf[mm]"]<=100 else "d")
    if grade in {"S460","S500","S550","S600","S650","S690","S700"}:
        curve_t=("a" if section["tf[mm]"]<=40 else "b") if hbr>1.2 else ("b" if section["tf[mm]"]<=100 else "c")
    alpha_t={"a0":.13,"a":.21,"b":.34,"c":.49,"d":.76}[curve_t]
    alpha_tf=min(alpha_t,alpha_t*math.sqrt(amm*fy*(ip**2+v["dz"]**2)/(6.25*G*it)))
    phi_t=.5*(1+(lambda_t/lambda_z)**2*alpha_tf*(lambda_z-.2)+lambda_t**2)
    chi_t=min(1,1/(phi_t+math.sqrt(max(0,phi_t**2-lambda_t**2)))); nbt=chi_t*npl/gm1
    ncry=math.pi**2*E*iy/(v["Lcry"]*1000)**2/1000; ic=math.sqrt(ic2); beta=1-(section["yc[mm]"]/ic)**2
    if beta<=0:raise DesignInputError("The section properties produce an unsupported torsional-flexural buckling coefficient.")
    ncrtf=(ncry+ncrt-math.sqrt(max(0,(ncry+ncrt)**2-4*beta*ncry*ncrt)))/(2*beta)
    lambda_tf=math.sqrt(npl/ncrtf);phi_tf=.5*(1+(lambda_tf/lambda_z)**2*alpha_tf*(lambda_z-.2)+lambda_tf**2)
    chi_tf=min(1,1/(phi_tf+math.sqrt(max(0,phi_tf**2-lambda_tf**2))));nbtf=chi_tf*npl/gm1
    mcr=v["Mcr"]
    if mcr<=0:mcr=mcr_from_case(section,v,int(p.get("case",2)),str(p.get("loadloc","middle")))
    if mcr<=0:raise DesignInputError("Elastic critical moment Mcr must be greater than zero.")
    myrk=section["Wpl,y[cm3]"]*fy*.001;lambda_lt=math.sqrt(myrk/mcr);alpha_lt=.21 if section["h[mm]"]/section["b[mm]"]<=2 else .34
    ltb_required=lambda_lt>.4 and abs(v["My"])>.16*mcr;phi_lt=.5*(1+alpha_lt*(lambda_lt-.2)+lambda_lt**2)
    chi_lt=min(1,1/(phi_lt+math.sqrt(max(0,phi_lt**2-lambda_lt**2)))) if ltb_required else 1
    mb_rd=(chi_lt*myrk if ltb_required else myrk)/gm1
    my_reduced=myrd*math.sqrt(max(0,1-abs(v["B"])/max(1e-9,(.25*section["tf[mm]"]*section["b[mm]"]**2*(section["h[mm]"]-section["tf[mm]"])*fy*1e-9)/gm0)))
    sec_class=classify(section,fy,v)["overall"]
    if sec_class==3 and str(p.get("annex","yes"))=="no":raise DesignInputError("This section is Class 3. Enable the Annex B method to continue, as required by the supplied Python procedure.")
    if sec_class==3:
        eps=math.sqrt(235/fy);cw=section["h[mm]"]-2*section["tf[mm]"]-2*section["r1[mm]"];cf=(section["b[mm]"]-section["tw[mm]"]-2*section["r1[mm]"])/2
        by=min(1,max(cf/(section["tf[mm]"]*4*eps)-2.5,cw/(section["tw[mm]"]*38*eps)-83/38,0));bz=min(1,max(cf/(section["tf[mm]"]*6*eps)-10/6,0))
        wy=section["Wpl,y[cm3]"]-(section["Wpl,y[cm3]"]-section["Wy[cm3]"])*by;wz=section["Wpl,z[cm3]"]-(section["Wpl,z[cm3]"]-section["Wz[cm3]"])*bz
        myrd=wy*fy*.001/gm0;mzrd=wz*fy*.001/gm0
        my_reduced=myrd*math.sqrt(max(0,1-abs(v["B"])/max(1e-9,(.25*section["tf[mm]"]*section["b[mm]"]**2*(section["h[mm]"]-section["tf[mm]"])*fy*1e-9)/gm0)))
        lambda_lt=math.sqrt(myrd*gm0/mcr);phi_lt=.5*(1+alpha_lt*(lambda_lt-.2)+lambda_lt**2)
        ltb_required=lambda_lt>.4 and abs(v["My"])>.16*mcr;chi_lt=min(1,1/(phi_lt+math.sqrt(max(0,phi_lt**2-lambda_lt**2)))) if ltb_required else 1
        mb_rd=(chi_lt*myrd*gm0 if ltb_required else myrd*gm0)/gm1
    if sec_class==4:raise DesignInputError("Class 4 sections are not available in the supplied Python procedure. Choose a stockier section.")
    hw=section["h[mm]"]-2*section["tf[mm]"];wy_used=myrd*gm0/(fy*.001);wz_used=mzrd*gm0/(fy*.001)
    wb=.25*section["tf[mm]"]*section["b[mm]"]**2*(hw+section["tf[mm]"]);brd=wb*fy*1e-9/gm0
    if brd<=0 or 1-v["B"]/brd<0:raise DesignInputError("Bimoment exceeds the supported plastic resistance.")
    myb=math.sqrt(1-v["B"]/brd)*myrd;mybv=myb
    if abs(v["Vz"])>.5*vpl_t:
        rho=(2*abs(v["Vz"])/vpl_t-1)**2;my_shear=((wy_used-rho*section["tw[mm]"]*hw**2/4)*fy/gm0)*.001
        mybv=min(my_shear*(myb/myrd),myb)
    a=min((area*100-2*section["b[mm]"]*section["tf[mm]"])/(area*100),.5);n=abs(v["N"]/nrd);mybvn=mybv
    if not(v["N"]<=.25*nrd and v["N"]<=.5*hw*section["tw[mm]"]*fy*.001/gm0):mybvn=min(mybv*(1-n)/(1-.5*a),mybv)
    mnzrd=mzrd
    if v["N"]>hw*section["tw[mm]"]*fy*.001/gm0 and n>a:mnzrd=mzrd*(1-((n-a)/(1-a))**2)
    if mybvn<=0 or mnzrd<=0:raise DesignInputError("Design action exceeds cross-section resistance.")
    my_reduced=mybvn;nrd_use=nrd if v["N"]>0 else min(nrd,nurd)
    ratios={"Axial cross-section":abs(v["N"])/nrd_use,"Bending y-axis":abs(v["My"])/my_reduced,"Bending z-axis":abs(v["Mz"])/mnzrd,"Shear z-direction":abs(v["Vz"])/vpl_t,
        "Flexural buckling y-axis":v["N"]/fby["Nb"] if v["N"]>0 else 0,"Flexural buckling z-axis":v["N"]/fbz["Nb"] if v["N"]>0 else 0,
        "Torsional buckling":v["N"]/nbt if v["N"]>0 else 0,"Torsional-flexural buckling":v["N"]/nbtf if v["N"]>0 else 0,"Lateral torsional buckling":abs(v["My"])/mb_rd}
    ratios["Biaxial bending"]=(v["My"]/my_reduced)**2+(v["Mz"]/mnzrd)**max(1,5*v["N"]/nrd) if abs(v["My"])>0 and abs(v["Mz"])>0 else max(ratios["Bending y-axis"],ratios["Bending z-axis"])
    ny=v["N"]/fby["Nb"] if v["N"]>0 else 0;nz=v["N"]/fbz["Nb"] if v["N"]>0 else 0;load=str(p.get("loadtype","Uniform"))
    cy=moment_factor(int(p.get("Cmy",1)),v["psiY"],v["alphaY"],load);cz=moment_factor(int(p.get("Cmz",1)),v["psiZ"],v["alphaZ"],load);clt=moment_factor(int(p.get("CmLT",1)),v["psiLT"],v["alphaLT"],load)
    kf=interaction(ny,nz,cy,cz,clt,fby["lambda"],fbz["lambda"],sec_class);ntf=v["N"]/nbtf if v["N"]>0 else 0
    ktf=interaction(ny,ntf,cy,cz,clt,fby["lambda"],lambda_tf,sec_class);nrk=area*fy*.1;myrk=myrd*gm0;mzrk=mzrd*gm0;ne=max(0,v["N"])
    ratios["Combined interaction · Eq. 8.88"]=ne/(fby["chi"]*nrk/gm1)+kf["kyy"]*abs(v["My"])/(chi_lt*myrk/gm1)+kf["kyz"]*abs(v["Mz"])/(mzrk/gm1)
    ratios["Combined interaction · Eq. 8.89"]=ne/(fbz["chi"]*nrk/gm1)+kf["kzy"]*abs(v["My"])/(chi_lt*myrk/gm1)+kf["kzz"]*abs(v["Mz"])/(mzrk/gm1)
    ratios["Combined interaction · Eq. 8.88, TF"]=ne/(chi_tf*nrk/gm1)+ktf["kyy"]*abs(v["My"])/(chi_lt*myrk/gm1)+ktf["kyz"]*abs(v["Mz"])/(mzrk/gm1)
    ratios["Combined interaction · Eq. 8.89, TF"]=ne/(chi_tf*nrk/gm1)+ktf["kzy"]*abs(v["My"])/(chi_lt*myrk/gm1)+ktf["kzz"]*abs(v["Mz"])/(mzrk/gm1)
    gov=max(ratios.items(),key=lambda item:item[1])
    specs=[("Flexural buckling reduction curve · y-axis",fby["alpha"],fby["lambda"],fby["chi"],None),("Flexural buckling reduction curve · z-axis",fbz["alpha"],fbz["lambda"],fbz["chi"],None),("Torsional buckling reduction curve",alpha_tf,lambda_t,chi_t,lambda_z),("Torsional-flexural buckling reduction curve",alpha_tf,lambda_tf,chi_tf,lambda_z),("Lateral torsional buckling reduction curve",alpha_lt,lambda_lt,chi_lt,None)]
    curves=[{"title":title,"alpha":alpha,"lambda":lam,"chi":chi,"coupledLambda":coupled,"points":reduction_points(alpha,coupled)} for title,alpha,lam,chi,coupled in specs]
    return {"v":v,"s":section,"mat":mat,"secClass":sec_class,"pass":gov[1]<=1,"gov":[gov[0],gov[1]],"ratios":ratios,
        "FB_y":fby,"FB_z":fbz,"lambdaT":lambda_t,"chiT":chi_t,"NbT":nbt,"ncrT":ncrt,"lambdaTF":lambda_tf,"chiTF":chi_tf,"NbTF":nbtf,"ncrTF":ncrtf,
        "lambdaLT":lambda_lt,"chiLT":chi_lt,"mbRd":mb_rd,"mcr":mcr,"nRd":nrd,"nuRd":nurd,"nRdUse":nrd_use,"myRd":myrd,"myReduced":my_reduced,"mzRd":mzrd,"mNzRd":mnzrd,"vplT":vpl_t,"kFlex":kf,"kTF":ktf,"lambdaZ":lambda_z,"aTF":alpha_tf,"alphaLT":alpha_lt,"ltbRequired":ltb_required,"curves":curves}

@app.get("/health")
def health()->dict[str,str]:return {"status":"ok","service":"steel-member-design-api"}

@app.post("/api/design-check")
def design_check(payload:dict[str,Any])->dict[str,Any]:
    try:return calculate_design(payload)
    except DesignInputError as exc:raise HTTPException(status_code=422,detail=str(exc)) from exc
    except (KeyError,IndexError,ZeroDivisionError,OverflowError,ValueError) as exc:raise HTTPException(status_code=422,detail=f"Unable to calculate this design: {exc}") from exc
