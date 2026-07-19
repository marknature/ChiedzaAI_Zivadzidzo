"""ZivaDzidzo neural portfolio and validation-weighted model fusion.

Inspired by ZivaBasa' baseline -> neural -> sanity-check pattern, but tailored to the
single Industry 4.0 education dataset. No learner identifiers are retained or exported.
"""
import csv, json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw" / "industry4_vocational_skill_mapping_dataset.csv"
MODELS = ROOT / "models"; MODELS.mkdir(exist_ok=True)
FEATURES = ["Theory_Score", "Assignment_Score", "Internal_Exam_Score", "Attendance_Percentage", "LMS_Login_Count", "LMS_Time_Spent_Hours", "Lab_Task_Completion_Percentage", "Lab_Accuracy_Score", "Practical_Exam_Score", "Simulation_Score", "Troubleshooting_Score", "AI_Skill_Score", "IoT_Skill_Score", "Robotics_Skill_Score", "Data_Analytics_Score", "Automation_Skill_Score", "Problem_Solving_Score", "Teamwork_Score", "Communication_Score"]
RNG = np.random.default_rng(42)

def softmax(values):
    values = values - values.max(axis=1, keepdims=True); expo = np.exp(values); return expo / expo.sum(axis=1, keepdims=True)
def relu(values): return np.maximum(values, 0)
def macro_f1(y, prediction, n_classes):
    scores=[]
    for label in range(n_classes):
        tp=np.sum((y==label)&(prediction==label)); fp=np.sum((y!=label)&(prediction==label)); fn=np.sum((y==label)&(prediction!=label)); p=tp/(tp+fp) if tp+fp else 0; r=tp/(tp+fn) if tp+fn else 0; scores.append(2*p*r/(p+r) if p+r else 0)
    return float(np.mean(scores))
def mae(y, prediction): return float(np.abs(y-prediction).mean())

def load():
    rows=list(csv.DictReader(RAW.open(encoding="utf-8")))
    return (np.array([[float(r[f]) for f in FEATURES] for r in rows]), np.array([r["Skill_Readiness_Level"] for r in rows]), np.array([float(r["Skill_Gap_Score"]) for r in rows]))

def stratified_split(labels):
    train=[]; validation=[]; test=[]
    for label in np.unique(labels):
        indices=np.where(labels==label)[0]; RNG.shuffle(indices); first=int(.70*len(indices)); second=int(.85*len(indices)); train.extend(indices[:first]); validation.extend(indices[first:second]); test.extend(indices[second:])
    return np.array(train), np.array(validation), np.array(test)

def centroid_probabilities(Z, centroids):
    distances=((Z[:,None,:]-centroids[None,:,:])**2).sum(axis=2); return softmax(-distances)
def train_softmax(Z, y, classes, epochs=350):
    W=np.zeros((Z.shape[1],len(classes))); b=np.zeros(len(classes)); Y=np.eye(len(classes))[y]
    for _ in range(epochs):
        p=softmax(Z@W+b); W-=.08*(Z.T@(p-Y)/len(Z)+.001*W); b-=.08*(p-Y).mean(0)
    return W,b
def train_classifier_mlp(Z, y, Z_val, y_val, n_classes, epochs=420):
    r=np.random.default_rng(7); p={"w1":r.normal(0,.12,(Z.shape[1],48)),"b1":np.zeros(48),"w2":r.normal(0,.12,(48,24)),"b2":np.zeros(24),"w3":r.normal(0,.12,(24,n_classes)),"b3":np.zeros(n_classes)}; Y=np.eye(n_classes)[y]; best=None; best_score=-1
    for epoch in range(epochs):
        z1=Z@p["w1"]+p["b1"]; a1=relu(z1); z2=a1@p["w2"]+p["b2"]; a2=relu(z2); prob=softmax(a2@p["w3"]+p["b3"]); d3=(prob-Y)/len(Z); d2=d3@p["w3"].T; d2[z2<=0]=0; d1=d2@p["w2"].T; d1[z1<=0]=0
        p["w3"]-=.035*(a2.T@d3+.0005*p["w3"]); p["b3"]-=.035*d3.sum(0); p["w2"]-=.035*(a1.T@d2+.0005*p["w2"]); p["b2"]-=.035*d2.sum(0); p["w1"]-=.035*(Z.T@d1+.0005*p["w1"]); p["b1"]-=.035*d1.sum(0)
        if epoch%10==0:
            score=macro_f1(y_val,np.argmax(classifier_mlp_probabilities(Z_val,p),axis=1),n_classes)
            if score>best_score: best_score=score; best={k:v.copy() for k,v in p.items()}
    return best
def classifier_mlp_probabilities(Z,p): return softmax(relu(relu(Z@p["w1"]+p["b1"])@p["w2"]+p["b2"])@p["w3"]+p["b3"])
def train_regressor_mlp(Z, y, Z_val, y_val, epochs=420):
    ym,ys=y.mean(),y.std() or 1; target=(y-ym)/ys; r=np.random.default_rng(11); p={"w1":r.normal(0,.10,(Z.shape[1],40)),"b1":np.zeros(40),"w2":r.normal(0,.10,(40,16)),"b2":np.zeros(16),"w3":r.normal(0,.10,(16,1)),"b3":np.zeros(1),"target_mean":float(ym),"target_scale":float(ys)}; best=None; best_score=float("inf")
    for epoch in range(epochs):
        z1=Z@p["w1"]+p["b1"]; a1=relu(z1); z2=a1@p["w2"]+p["b2"]; a2=relu(z2); out=(a2@p["w3"]+p["b3"]).ravel(); d3=(2*(out-target)/len(Z))[:,None]; d2=d3@p["w3"].T; d2[z2<=0]=0; d1=d2@p["w2"].T; d1[z1<=0]=0
        p["w3"]-=.02*(a2.T@d3+.0005*p["w3"]); p["b3"]-=.02*d3.sum(0); p["w2"]-=.02*(a1.T@d2+.0005*p["w2"]); p["b2"]-=.02*d2.sum(0); p["w1"]-=.02*(Z.T@d1+.0005*p["w1"]); p["b1"]-=.02*d1.sum(0)
        if epoch%10==0:
            score=mae(y_val,regressor_mlp_predict(Z_val,p))
            if score<best_score: best_score=score; best={k:(v.copy() if isinstance(v,np.ndarray) else v) for k,v in p.items()}
    return best
def regressor_mlp_predict(Z,p): return (relu(relu(Z@p["w1"]+p["b1"])@p["w2"]+p["b2"])@p["w3"]+p["b3"]).ravel()*p["target_scale"]+p["target_mean"]
def weights(scores, higher=True):
    values=np.array(scores,dtype=float); values=values if higher else 1/np.maximum(values,.0001); return values/values.sum()

def multitask_predict(Z, p):
    trunk=relu(relu(Z@p["w1"]+p["b1"])@p["w2"]+p["b2"])
    return softmax(trunk@p["class_w"]+p["class_b"]), (trunk@p["reg_w"]+p["reg_b"]).ravel()*p["target_scale"]+p["target_mean"]

def train_multitask_mlp(Z, y_class, y_gap, Z_val, y_class_val, y_gap_val, n_classes, epochs=460):
    """One shared trunk with separate softmax and regression heads, adapted from ZivaBasa."""
    r=np.random.default_rng(17); ym,ys=y_gap.mean(),y_gap.std() or 1; target=(y_gap-ym)/ys; Y=np.eye(n_classes)[y_class]
    p={"w1":r.normal(0,.11,(Z.shape[1],48)),"b1":np.zeros(48),"w2":r.normal(0,.11,(48,24)),"b2":np.zeros(24),"class_w":r.normal(0,.11,(24,n_classes)),"class_b":np.zeros(n_classes),"reg_w":r.normal(0,.11,(24,1)),"reg_b":np.zeros(1),"target_mean":float(ym),"target_scale":float(ys)}; best=None; best_score=-float("inf")
    for epoch in range(epochs):
        z1=Z@p["w1"]+p["b1"]; a1=relu(z1); z2=a1@p["w2"]+p["b2"]; trunk=relu(z2); prob=softmax(trunk@p["class_w"]+p["class_b"]); reg=(trunk@p["reg_w"]+p["reg_b"]).ravel()
        dc=(prob-Y)/len(Z); dr=(.25*2*(reg-target)/len(Z))[:,None]; dtrunk=dc@p["class_w"].T+dr@p["reg_w"].T; dz2=dtrunk.copy(); dz2[z2<=0]=0; da1=dz2@p["w2"].T; dz1=da1.copy(); dz1[z1<=0]=0
        p["class_w"]-=.03*(trunk.T@dc+.0005*p["class_w"]); p["class_b"]-=.03*dc.sum(0); p["reg_w"]-=.03*(trunk.T@dr+.0005*p["reg_w"]); p["reg_b"]-=.03*dr.sum(0); p["w2"]-=.03*(a1.T@dz2+.0005*p["w2"]); p["b2"]-=.03*dz2.sum(0); p["w1"]-=.03*(Z.T@dz1+.0005*p["w1"]); p["b1"]-=.03*dz1.sum(0)
        if epoch%10==0:
            cp,rp=multitask_predict(Z_val,p); score=macro_f1(y_class_val,np.argmax(cp,1),n_classes)-.01*mae(y_gap_val,rp)
            if score>best_score: best_score=score; best={k:(v.copy() if isinstance(v,np.ndarray) else v) for k,v in p.items()}
    return best

def main():
    X,labels,gap=load(); classes=np.unique(labels); y=np.array([np.where(classes==item)[0][0] for item in labels]); train,val,test=stratified_split(labels); mean=X[train].mean(0); scale=X[train].std(0); scale[scale==0]=1; Z=(X-mean)/scale
    centroids=np.array([Z[train][y[train]==kind].mean(0) for kind in range(len(classes))]); sw,sb=train_softmax(Z[train],y[train],classes); neural=train_multitask_mlp(Z[train],y[train],gap[train],Z[val],y[val],gap[val],len(classes)); neural_probs,neural_gap=multitask_predict(Z,neural)
    classifier_probs={"nearest_centroid":centroid_probabilities(Z,centroids),"softmax_regression":softmax(Z@sw+sb),"neural_mlp":neural_probs}
    base_validation={name:macro_f1(y[val],np.argmax(prob[val],1),len(classes)) for name,prob in classifier_probs.items()}; class_weights=weights(list(base_validation.values())); fusion=sum(weight*classifier_probs[name] for weight,name in zip(class_weights,base_validation))
    validation={**base_validation,"weighted_fusion":macro_f1(y[val],np.argmax(fusion[val],1),len(classes))}
    test_metrics={name:{"accuracy":round(float((np.argmax(prob[test],1)==y[test]).mean()),4),"macro_f1":round(macro_f1(y[test],np.argmax(prob[test],1),len(classes)),4)} for name,prob in classifier_probs.items()}; test_metrics["weighted_fusion"]={"accuracy":round(float((np.argmax(fusion[test],1)==y[test]).mean()),4),"macro_f1":round(macro_f1(y[test],np.argmax(fusion[test],1),len(classes),),4)}
    design=np.c_[np.ones(len(train)),Z[train]]; linear=np.linalg.pinv(design)@gap[train]; regressions={"mean_baseline":np.full(len(Z),gap[train].mean()),"linear_regression":np.c_[np.ones(len(Z)),Z]@linear,"neural_mlp":neural_gap}
    base_validation_reg={name:mae(gap[val],prediction[val]) for name,prediction in regressions.items()}; reg_weights=weights(list(base_validation_reg.values()),higher=False); fused_reg=sum(weight*regressions[name] for weight,name in zip(reg_weights,base_validation_reg)); validation_reg={**base_validation_reg,"weighted_fusion":mae(gap[val],fused_reg[val])}
    reg_metrics={name:{"mae":round(mae(gap[test],prediction[test]),4)} for name,prediction in regressions.items()}; reg_metrics["weighted_fusion"]={"mae":round(mae(gap[test],fused_reg[test]),4)}
    # Choose a deployment candidate using validation only; held-out test metrics are report-only.
    best_classifier=max(validation,key=validation.get); best_regressor=min(validation_reg,key=validation_reg.get)
    neural_json={key:(value.tolist() if isinstance(value,np.ndarray) else value) for key,value in neural.items()}
    artifact={"version":"industry4_neural_fusion_v1","created_at":datetime.now(timezone.utc).isoformat(),"dataset":RAW.name,"rows":int(len(X)),"features":FEATURES,"privacy_scope":"aggregate curriculum and skills insight only; not for individual learner decisions","normalization":{"mean":mean.tolist(),"scale":scale.tolist()},"classification":{"classes":classes.tolist(),"selected":best_classifier,"metrics":test_metrics,"validation_metrics":validation,"fusion_weights":dict(zip(validation.keys(),class_weights.tolist())),"majority_label":str(classes[np.bincount(y[train]).argmax()]),"centroids":centroids.tolist(),"softmax_weights":sw.tolist(),"softmax_bias":sb.tolist(),"neural":neural_json},"regression":{"selected":best_regressor,"metrics":reg_metrics,"validation_metrics":validation_reg,"fusion_weights":dict(zip(validation_reg.keys(),reg_weights.tolist())),"mean":float(gap[train].mean()),"linear_coefficients":linear.tolist(),"neural":neural_json}}
    (MODELS/"industry4_neural_fusion_model.json").write_text(json.dumps(artifact,indent=2),encoding="utf-8"); print(json.dumps({"artifact":"industry4_neural_fusion_model.json","classification":test_metrics,"regression":reg_metrics,"classification_weights":artifact["classification"]["fusion_weights"],"regression_weights":artifact["regression"]["fusion_weights"]},indent=2))

if __name__=="__main__": main()
